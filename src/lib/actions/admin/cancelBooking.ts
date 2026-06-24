'use server'

import { createClient } from '@/lib/supabase/server'
import { sendCancelEmail } from '@/lib/emails/cancel'
import { deleteGcalEvent } from '@/lib/gcal/pushSync'

export async function cancelBooking(
  bookingId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Unauthorized' }

  const { data: booking, error: fetchError } = await supabase
    .from('bookings')
    .select('id, status, confirmation_code, customer_email, customer_name, band_name, start_at, gcal_event_id')
    .eq('id', bookingId)
    .single()

  if (fetchError || !booking) return { success: false, error: 'Booking not found' }
  if (booking.status === 'cancelled') return { success: false, error: 'Already cancelled' }

  const { error: updateError } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)

  if (updateError) return { success: false, error: updateError.message }

  // D-07: email only for confirmed cancels; pending cancels are silent
  if (booking.status === 'confirmed') {
    sendCancelEmail(booking).catch((err) =>
      console.error('[email:cancel]', err)
    )
  }

  if (booking.status === 'confirmed' && booking.gcal_event_id) {
    void deleteGcalEvent(booking.gcal_event_id as string).catch((err: unknown) => {
      console.error('[gcal:push] cancelBooking delete failed', err)
    })
  }

  return { success: true }
}
