import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { sendTelegramMessage, newPendingBookingMessage } from '@/lib/telegram'

export async function notifyNewPendingBooking(
  supabase: SupabaseClient<Database>,
  confirmationCode: string,
  occurrenceCount = 1
) {
  try {
    const { data: row } = await supabase
      .from('bookings')
      .select('customer_name, band_name, start_at, end_at, total_amount, deposit_amount, payment_method, status')
      .eq('confirmation_code', confirmationCode)
      .single()
    if (row?.status !== 'pending') return
    const suffix = occurrenceCount > 1 ? `\n+${occurrenceCount - 1} more weekly occurrence(s)` : ''
    await sendTelegramMessage(
      newPendingBookingMessage({
        confirmationCode,
        customerName: row.customer_name,
        bandName: row.band_name,
        startAt: row.start_at,
        endAt: row.end_at,
        totalAmount: row.total_amount,
        depositAmount: row.deposit_amount,
        paymentMethod: row.payment_method,
      }) + suffix
    )
  } catch (err) {
    console.error('[telegram] new booking alert failed', err)
  }
}
