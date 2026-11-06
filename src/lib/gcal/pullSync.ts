import { google, calendar_v3 } from 'googleapis'
import { getGcalClient } from './client'
import { createServiceClient } from '@/lib/supabase/serviceClient'

// Duck-typed shape for GaxiosError (googleapis-common is not a direct dep)
type GaxiosLike = {
  response?: { status?: number }
}

function isGaxiosError(err: unknown): err is GaxiosLike {
  return (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as GaxiosLike).response === 'object'
  )
}

export class SyncTokenExpiredError extends Error {
  constructor() {
    super('GCal syncToken expired — full sync required')
    this.name = 'SyncTokenExpiredError'
  }
}

type ListResult = {
  events: calendar_v3.Schema$Event[]
  nextSyncToken: string
}

async function listExternalEvents(
  calendar: calendar_v3.Calendar,
  calendarId: string,
  syncToken: string | null | undefined
): Promise<ListResult> {
  const allEvents: calendar_v3.Schema$Event[] = []
  let pageToken: string | undefined
  let nextSyncToken: string | undefined

  try {
    do {
      const response = await calendar.events.list({
        calendarId,
        ...(syncToken ? { syncToken } : {}),
        ...(pageToken ? { pageToken } : {}),
        singleEvents: true,
        showDeleted: true,
      })

      const items = response.data.items ?? []
      allEvents.push(...items)
      pageToken = response.data.nextPageToken ?? undefined
      nextSyncToken = response.data.nextSyncToken ?? undefined
    } while (pageToken)
  } catch (err) {
    if (isGaxiosError(err) && err.response?.status === 410) {
      throw new SyncTokenExpiredError()
    }
    throw err
  }

  return { events: allEvents, nextSyncToken: nextSyncToken ?? '' }
}

/**
 * Runs an incremental (or full if no syncToken) pull from Google Calendar.
 * Filters out DMS-owned events, detects conflicts with confirmed bookings,
 * upserts blocked_slots for external events, and deletes rows for cancelled events.
 */
export async function runPullSync(): Promise<{ inserted: number; deleted: number; conflicts: number }> {
  const client = await getGcalClient()
  if (!client) return { inserted: 0, deleted: 0, conflicts: 0 }

  const { oauth2Client, calendarId, googleTokensRow } = client
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as unknown as { from(table: string): any }

  const currentSyncToken = googleTokensRow.sync_token as string | null | undefined

  let events: calendar_v3.Schema$Event[]
  let nextSyncToken: string

  try {
    ;({ events, nextSyncToken } = await listExternalEvents(calendar, calendarId, currentSyncToken))
  } catch (err: unknown) {
    if (err instanceof SyncTokenExpiredError) {
      // Keep the saved token until the full replay has persisted successfully.
      ;({ events, nextSyncToken } = await listExternalEvents(calendar, calendarId, null))
    } else {
      throw err
    }
  }

  // Filter out DMS-owned events (they have our private extendedProperty)
  const external = events.filter(
    (e) => !e.extendedProperties?.private?.['dms_booking_id']
  )

  let inserted = 0
  let deleted = 0
  let conflicts = 0

  for (const e of external) {
    if (e.status === 'cancelled') {
      // Remove blocked_slot for cancelled GCal event
      const { error } = await db
        .from('blocked_slots')
        .delete()
        .eq('external_id', e.id)
      if (error) throw error
      deleted++
      continue
    }

    const startAt = e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T00:00:00+08:00` : null)
    const endAt = e.end?.dateTime ?? (e.end?.date ? `${e.end.date}T00:00:00+08:00` : null)
    if (!e.id || !startAt || !endAt || !Number.isFinite(Date.parse(startAt)) || !Number.isFinite(Date.parse(endAt)) || Date.parse(startAt) >= Date.parse(endAt)) {
      throw new Error('Calendar event has an invalid time range')
    }

    // Google all-day dates use an exclusive end; studio blocks use Manila time.
    const { data: conflictRows, error: conflictError } = await db
      .from('bookings')
      .select('id, confirmation_code')
      .eq('status', 'confirmed')
      .lt('start_at', endAt)
      .gt('end_at', startAt)
    if (conflictError) throw conflictError

    if (conflictRows && conflictRows.length > 0) {
      console.error('[gcal:pull] conflict skipped', { gcalEventId: e.id, conflicts: conflictRows })
      conflicts++
      continue
    }

    // Upsert blocked_slot for this external GCal event
    const { error: writeError } = await db
      .from('blocked_slots')
      .upsert(
        {
          type: 'gcal',
          external_id: e.id,
          start_at: startAt,
          end_at: endAt,
          reason: e.summary ?? 'GCal event',
        },
        { onConflict: 'external_id' }
      )
    if (writeError) throw writeError
    inserted++
  }

  // Persist the new syncToken for the next incremental sync
  const { error: tokenError } = await db
    .from('google_tokens')
    .update({ sync_token: nextSyncToken, updated_at: new Date().toISOString() })
    .eq('id', googleTokensRow.id)
  if (tokenError) throw tokenError

  return { inserted, deleted, conflicts }
}
