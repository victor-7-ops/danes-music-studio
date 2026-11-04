export const runtime = 'nodejs'

import { createServiceClient } from '@/lib/supabase/serviceClient'
import { sendReminderEmail } from '@/lib/emails/reminder'

export async function POST(request: Request): Promise<Response> {
  const secret = request.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) return new Response('Unauthorized', { status: 401 })

  const supabase = createServiceClient()
  const { data: settings, error: settingsError } = await supabase.from('settings').select('reminder_enabled').limit(1).single()
  if (settingsError) return Response.json({ ok: false, error: 'settings read failed' }, { status: 500 })
  if (!settings?.reminder_enabled) return Response.json({ ok: true, skipped: 'reminder_enabled=false' })

  const startWindow = new Date(Date.now() + 23 * 60 * 60 * 1000)
  const endWindow = new Date(Date.now() + 25 * 60 * 60 * 1000)
  const { data: bookings, error: claimError } = await supabase.rpc('claim_booking_reminders', {
    p_start: startWindow.toISOString(), p_end: endWindow.toISOString(),
  })
  if (claimError) {
    console.error('[cron] reminder claim failed', claimError)
    return Response.json({ ok: false, error: 'claim failed' }, { status: 500 })
  }

  let sent = 0
  let errors = 0
  for (const booking of bookings ?? []) {
    const claimedAt = booking.reminder_claimed_at
    if (!claimedAt) {
      errors++
      console.error('[cron] reminder claim had no lease timestamp', booking.id)
      continue
    }
    try {
      await sendReminderEmail(booking)
      const { data: saved, error } = await supabase.from('bookings')
        .update({ reminder_sent: true, reminder_claimed_at: null })
        .eq('id', booking.id).eq('reminder_sent', false).eq('reminder_claimed_at', claimedAt)
        .select('id').maybeSingle()
      if (error || !saved) throw error ?? new Error('Reminder claim no longer belongs to this worker')
      sent++
    } catch (err) {
      console.error('[cron] reminder delivery/persist failed for booking', booking.id, err)
      errors++
      const { error: releaseError } = await supabase.from('bookings')
        .update({ reminder_claimed_at: null })
        .eq('id', booking.id).eq('reminder_sent', false).eq('reminder_claimed_at', claimedAt)
      if (releaseError) console.error('[cron] failed to release reminder claim', releaseError)
    }
  }
  return Response.json({ ok: errors === 0, sent, errors }, { status: errors === 0 ? 200 : 502 })
}
