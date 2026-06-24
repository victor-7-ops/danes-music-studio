import { google } from 'googleapis'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { decryptToken } from './crypto'

/**
 * Returns a configured OAuth2Client using env vars.
 * Let the SDK throw naturally if env vars are missing.
 */
export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  )
}

/**
 * Returns the Google OAuth authorization URL.
 * prompt:'consent' is MANDATORY — without it Google only returns a refresh_token on the very first auth.
 */
export function generateAuthUrl(oauth2Client: ReturnType<typeof createOAuth2Client>): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    prompt: 'consent',
  })
}

export type GcalClientResult = {
  oauth2Client: ReturnType<typeof createOAuth2Client>
  calendarId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  googleTokensRow: Record<string, any>
}

/**
 * Reads google_tokens from Supabase, decrypts the refresh token, and returns
 * a ready-to-use OAuth2Client + metadata. Returns null if not connected.
 */
export async function getGcalClient(): Promise<GcalClientResult | null> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as unknown as { from(table: string): any }
  const { data, error } = await db
    .from('google_tokens')
    .select(
      'id, encrypted_refresh_token, google_email, calendar_id, sync_token, watch_channel_id, watch_resource_id, watch_expires_at'
    )
    .single()

  if (error || !data) return null

  const oauth2Client = createOAuth2Client()
  const decrypted = decryptToken(data.encrypted_refresh_token as string)
  oauth2Client.setCredentials({ refresh_token: decrypted })

  return {
    oauth2Client,
    calendarId: data.calendar_id as string,
    googleTokensRow: data as Record<string, unknown>,
  }
}

/**
 * Registers a push notification watch channel for GCal events.
 * Returns channelId, resourceId, and expiration as strings.
 */
export async function registerWatchChannel(params: {
  webhookUrl: string
  verificationToken: string
}): Promise<{ channelId: string; resourceId: string; expiration: string }> {
  const client = await getGcalClient()
  if (!client) throw new Error('[gcal:client] Not connected — cannot register watch channel')

  const { oauth2Client, calendarId } = client
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  const { data } = await calendar.events.watch({
    calendarId,
    requestBody: {
      id: randomUUID(),
      type: 'web_hook',
      address: params.webhookUrl,
      token: params.verificationToken,
    },
  })

  return {
    channelId: data.id ?? '',
    resourceId: data.resourceId ?? '',
    expiration: data.expiration ?? '',
  }
}

/**
 * Stops an active push notification channel.
 * Used on disconnect and before watch renewal.
 */
export async function stopWatchChannel(params: {
  channelId: string
  resourceId: string
}): Promise<void> {
  const client = await getGcalClient()
  if (!client) {
    console.warn('[gcal:client] Not connected — cannot stop watch channel')
    return
  }

  const { oauth2Client } = client
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client })

  await calendar.channels.stop({
    requestBody: {
      id: params.channelId,
      resourceId: params.resourceId,
    },
  })
}
