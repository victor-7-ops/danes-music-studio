export const runtime = 'nodejs'

import { stopWatchChannel, registerWatchChannel, getGcalClient } from '@/lib/gcal/client'
import { createServiceClient } from '@/lib/supabase/serviceClient'

export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return new Response('Forbidden', { status: 403 })
  }

  try {
    const gcal = await getGcalClient()
    if (!gcal) {
      return Response.json({ ok: true, skipped: true, reason: 'not_connected' })
    }

    const { googleTokensRow } = gcal

    if (
      typeof googleTokensRow.watch_channel_id === 'string' &&
      googleTokensRow.watch_channel_id &&
      typeof googleTokensRow.watch_resource_id === 'string' &&
      googleTokensRow.watch_resource_id
    ) {
      try {
        await stopWatchChannel({
          channelId: googleTokensRow.watch_channel_id as string,
          resourceId: googleTokensRow.watch_resource_id as string,
        })
      } catch (err) {
        console.error('[gcal-cron:renew] stopWatchChannel failed (continuing anyway)', err)
      }
    }

    const webhookUrl = process.env.GOOGLE_REDIRECT_URI!.replace(
      '/api/auth/google/callback',
      '/api/webhooks/google-calendar'
    )

    const { channelId, resourceId, expiration } = await registerWatchChannel({
      webhookUrl,
      verificationToken: process.env.GCAL_WEBHOOK_TOKEN!,
    })

    const supabase = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as unknown as { from(table: string): any }
    const { error } = await db
      .from('google_tokens')
      .update({
        watch_channel_id: channelId,
        watch_resource_id: resourceId,
        watch_expires_at: new Date(Number(expiration)).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', googleTokensRow.id)
    if (error) throw error

    return Response.json({
      ok: true,
      channelId,
      expiresAt: new Date(Number(expiration)).toISOString(),
    })
  } catch (err) {
    console.error('[gcal-cron:renew] failed', err)
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    )
  }
}
