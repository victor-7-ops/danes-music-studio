import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { pushGcalEvent } from '@/lib/gcal/pushSync'
import { sendConfirmEmail } from '@/lib/emails/confirm'
import { sendTelegramMessage, paymentConfirmedMessage } from '@/lib/telegram'

// Shared by the admin "confirm payment" action and the Telegram webhook
// button — both must enforce the exact same rules. Callers are responsible
// for their own authorization check before calling this (admin session for
// the UI action, a validated webhook secret for the bot).
export async function applyPaymentConfirmation(
  supabase: SupabaseClient<Database>,
  bookingId: string,
  amountReceived: number,
  paymentType?: 'full' | 'deposit'
): Promise<{ success: boolean; error?: string; warning?: string }> {
  if (!bookingId || typeof bookingId !== 'string') {
    return { success: false, error: 'Invalid booking ID.' }
  }
  if (typeof amountReceived !== 'number' || !Number.isInteger(amountReceived) || amountReceived < 0) {
    return { success: false, error: 'Invalid amount.' }
  }

  const { data: existing, error: fetchError } = await supabase
    .from('bookings')
    .select('total_amount, amount_paid, status, source, payment_proof_url')
    .eq('id', bookingId)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: fetchError?.message ?? 'Booking not found.' }
  }
  if (!['pending', 'confirmed'].includes(existing.status) || amountReceived < existing.amount_paid || (existing.status === 'confirmed' && amountReceived === existing.amount_paid)) {
    return { success: false, error: 'Payment or booking state has changed. Refresh before confirming.' }
  }
  if (existing.source === 'online' && !existing.payment_proof_url) {
    return { success: false, error: 'No payment proof has been uploaded for this booking yet.' }
  }

  const payment_method = paymentType ?? (amountReceived >= existing.total_amount ? 'full' : 'deposit')

  const { data: updated, error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed', amount_paid: amountReceived, payment_method })
    .eq('id', bookingId)
    .eq('status', existing.status)
    .eq('amount_paid', existing.amount_paid)
    .select('confirmation_code, customer_email, customer_name, band_name, start_at, end_at, total_amount, amount_paid, cancel_token')
    .single()

  if (error || !updated) return { success: false, error: 'Payment or booking state has changed. Refresh before confirming.' }

  const warnings: string[] = []
  const synced = await pushGcalEvent(bookingId).catch((err: unknown) => {
    console.error('[gcal:push] confirmPayment failed', err)
    warnings.push('Calendar sync failed. Retry from the booking actions.')
  })
  if (synced === false) warnings.push('Google Calendar is not connected. Connect it in Settings, then retry.')

  await sendConfirmEmail(updated).catch((err: unknown) => {
    console.error('[email] confirmPayment confirm failed', err)
    warnings.push('Confirmation email failed. Retry from the booking actions.')
  })

  await sendTelegramMessage(
    paymentConfirmedMessage({
      confirmationCode: updated.confirmation_code,
      customerName: updated.customer_name,
      bandName: updated.band_name,
      amountPaid: updated.amount_paid,
    })
  ).catch((err: unknown) => {
    console.error('[telegram] confirmPayment alert failed', err)
  })

  return { success: true, ...(warnings.length ? { warning: warnings.join(' ') } : {}) }
}
