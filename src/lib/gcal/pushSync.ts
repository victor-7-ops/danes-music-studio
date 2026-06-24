import { google } from 'googleapis'
import { getGcalClient } from './client'
import { createClient } from '@/lib/supabase/server'

/**
 * Idempotent push: if booking already has a gcal_event_id, patches the existing event.
 * If not, inserts a new event and writes gcal_event_id back to the bookings row.
 */
export async function pushGcalEvent(bookingId: string): Promise<void> {
  const client = await getGcalClient()
  if (!client) {
    console.warn('[gcal:push] not connected, skipping')
    return
  }

  const { oauth2Client, calendarId } = client
  const supabase = await createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as unknown as { from(table: string): any }
  const { data: booking, error } = await db
    .from('bookings')
    .select('id, gcal_event_id, band_name, start_at, end_at, total_amount, amount_paid, confirmation_code, source')
    .eq('id', bookingId)
    .single()

  if (error || !booking) return

  const hours = Math.round(
    (new Date(booking.end_at as string).getTime() - new Date(booking.start_at as string).getTime()) /
      3_600_000
  )
  const balance = (booking.total_amount as number) - (booking.amount_paid as number)

  // Format centavo amounts to pesos with 2 decimal places
  const fmt = (centavos: number) => (centavos / 100).toFixed(2)

  const requestBody = {
    summary: `[DMS] ${(booking.band_name as string | null) ?? 'Walk-in'} — ${hours}hr rehearsal`,
    description: [
      `Booking: ${booking.confirmation_code as string}`,
      `Paid: ₱${fmt(booking.amount_paid as number)}`,
      `Balance: ₱${fmt(balance)}`,
      `Source: ${booking.source as string}`,
    ].join('\n'),
    start: { dateTime: booking.start_at as string, timeZone: 'Asia/Manila' },
    end: { dateTime: booking.end_at as string, timeZone: 'Asia/Manila' },
    extendedProperties: {
      private: { dms_booking_id: bookingId },
    },
  }

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  if (booking.gcal_event_id) {
    // Idempotent update: booking already has a GCal event — patch it
    await calendar.events.patch({
      calendarId,
      eventId: booking.gcal_event_id as string,
      requestBody,
    })
  } else {
    // New event: insert then write gcal_event_id back
    const result = await calendar.events.insert({
      calendarId,
      requestBody,
    })
    const gcalEventId = result.data.id!
    await db
      .from('bookings')
      .update({ gcal_event_id: gcalEventId })
      .eq('id', bookingId)
  }
}

/**
 * Deletes a GCal event by its event ID. No-op if calendar is not connected.
 */
export async function deleteGcalEvent(gcalEventId: string): Promise<void> {
  const client = await getGcalClient()
  if (!client) {
    console.warn('[gcal:push] not connected, skipping delete')
    return
  }

  const { oauth2Client, calendarId } = client
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  await calendar.events.delete({
    calendarId,
    eventId: gcalEventId,
  })
}
