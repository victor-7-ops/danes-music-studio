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
  if (typeof amountReceived !== 'number' || amountReceived < 0) {
    return { success: false, error: 'Invalid amount.' }
  }

  const { data: updated, error } = await supabase
    .from('bookings')
    .update({ status: 'confirmed', amount_paid: amountReceived })
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
