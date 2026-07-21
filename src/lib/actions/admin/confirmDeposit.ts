'use server'

import { createClient } from '@/lib/supabase/server'
import { pushGcalEvent } from '@/lib/gcal/pushSync'
import { sendConfirmEmail } from '@/lib/emails/confirm'
import { sendTelegramMessage, paymentConfirmedMessage } from '@/lib/telegram'

export async function confirmDeposit(
  bookingId: string,
  amountReceived: number
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  if (!bookingId || typeof bookingId !== 'string') {
    return { success: false, error: 'Invalid booking ID.' }
  }
  if (typeof amountReceived !== 'number' || !Number.isInteger(amountReceived) || amountReceived < 0) {
    return { success: false, error: 'Invalid amount.' }
  }

  const { data: existing, error: fetchError } = await supabase
    .from('bookings')
    .select('total_amount')
    .eq('id', bookingId)
    .single()

  if (fetchError || !existing) {
    return { success: false, error: fetchError?.message ?? 'Booking not found.' }
  }

  // Full vs deposit is inferred from the amount relative to the booking
  // total — this action accepts any admin-entered amount, not just the
  // preset deposit/full buttons, so there's no separate payment-type input.
  const payment_method = amountReceived >= existing.total_amount ? 'full' : 'deposit'

  const { data: updated, error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed', amount_paid: amountReceived, payment_method })
    .eq('id', bookingId)
    .neq('status', 'cancelled')
    .select('confirmation_code, customer_email, customer_name, band_name, start_at, end_at, total_amount, amount_paid, cancel_token')
    .single()

  if (error) return { success: false, error: error.message }

  void pushGcalEvent(bookingId).catch((err: unknown) => {
    console.error('[gcal:push] confirmDeposit failed', err)
  })

  if (updated) {
    sendConfirmEmail(updated).catch((err: unknown) => {
      console.error('[email] confirmDeposit confirm failed', err)
    })

    void sendTelegramMessage(
      paymentConfirmedMessage({
        confirmationCode: updated.confirmation_code,
        customerName: updated.customer_name,
        bandName: updated.band_name,
        amountPaid: updated.amount_paid,
      })
    ).catch((err: unknown) => {
      console.error('[telegram] confirmDeposit alert failed', err)
    })
  }

  return { success: true }
}
