import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { sendCancelEmail } from '@/lib/emails/cancel'
import { deleteGcalEvent } from '@/lib/gcal/pushSync'

// Shared by the admin "cancel booking" action and the Telegram webhook
// button. Callers must perform their own authorization check first.
export async function applyBookingCancellation(
  supabase: SupabaseClient<Database>,
  bookingId: string
): Promise<{ success: boolean; error?: string; warning?: string }> {
  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('id, status, confirmation_code, customer_email, customer_name, band_name, start_at, gcal_event_id')
    .eq('id', bookingId)
    .single()

  if (fetchError || !booking) return { success: false, error: 'Booking not found' }
  if (booking.status === 'cancelled') return { success: false, error: 'Already cancelled' }
  if (booking.status === 'completed') return { success: false, error: 'Cannot cancel a completed booking' }

  const { data: updated, error: updateError } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('status', booking.status)
    .select('id')
    .single()

  if (updateError || !updated) return { success: false, error: 'Booking state has changed. Refresh and try again.' }

  const warnings: string[] = []
  if (booking.status === 'confirmed') {
    await sendCancelEmail(booking).catch((err) => {
      console.error('[email:cancel]', err)
      warnings.push('Cancellation email failed. Retry from the booking actions.')
    })

    const removed = await deleteGcalEvent(booking).catch((err: unknown) => {
      console.error('[gcal:push] cancelBooking delete failed', err)
      warnings.push('Calendar removal failed. Retry from the booking actions.')
    })
    if (removed === false) warnings.push('Google Calendar is not connected. Reconnect in Settings, then retry removal.')
  }

  return { success: true, ...(warnings.length ? { warning: warnings.join(' ') } : {}) }
}
