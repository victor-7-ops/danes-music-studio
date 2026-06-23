export const runtime = 'nodejs'

import { createClient } from '@/lib/supabase/server'
import { sendReminderEmail } from '@/lib/emails/reminder'

export async function POST(request: Request): Promise<Response> {
  // T-04-05: auth gate — reject missing or wrong secret
  const secret = request.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = await createClient()

  // Check reminder_enabled in settings (D-04)
  const { data: settings } = await supabase
    .from('settings')
    .select('reminder_enabled')
    .limit(1)
    .single()

  if (!settings?.reminder_enabled) {
    return new Response(
      JSON.stringify({ ok: true, skipped: 'reminder_enabled=false' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // D-02: query confirmed bookings in 23h–25h window with reminder_sent=false
  const startWindow = new Date(Date.now() + 23 * 60 * 60 * 1000)
  const endWindow = new Date(Date.now() + 25 * 60 * 60 * 1000)

  const { data: bookings, error: queryError } = await supabase
    .from('bookings')
    .select('id, confirmation_code, customer_email, customer_name, band_name, start_at, end_at')
    .eq('status', 'confirmed')
    .eq('reminder_sent', false)
    .gte('start_at', startWindow.toISOString())
    .lte('start_at', endWindow.toISOString())

  if (queryError) {
    console.error('[cron] failed to query bookings:', queryError)
    return new Response(
      JSON.stringify({ ok: false, error: 'query failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let sent = 0
  let errors = 0

  // T-04-07: per-booking try/catch — one failure must not abort the loop
  for (const booking of bookings ?? []) {
    try {
      await sendReminderEmail(booking)
      // T-04-08: atomic guard — WHERE reminder_sent=false prevents double-send
      await supabase
        .from('bookings')
        .update({ reminder_sent: true })
        .eq('id', booking.id)
        .eq('reminder_sent', false)
      sent++
    } catch (err) {
      console.error('[cron] reminder failed for booking', booking.id, err)
      errors++
      // continue to next booking — do NOT rethrow
    }
  }

  // T-04-06: response body limited to aggregate counts — no booking PII
  return new Response(
    JSON.stringify({ ok: true, sent, errors }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
