'use server'

import { createClient } from '@/lib/supabase/server'
import { pushGcalEvent, deleteGcalEvent } from '@/lib/gcal/pushSync'
import { sendConfirmEmail } from '@/lib/emails/confirm'
import { sendCancelEmail } from '@/lib/emails/cancel'

export async function retryBookingDelivery(bookingId: string, channel: 'calendar' | 'email') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') return { success: false, error: 'Unauthorized' }
  if (!bookingId || !['calendar', 'email'].includes(channel)) return { success: false, error: 'Invalid request.' }

  const { data: booking, error } = await supabase.from('bookings')
    .select('id,status,gcal_event_id,confirmation_code,customer_email,customer_name,band_name,start_at,end_at,total_amount,amount_paid,cancel_token')
    .eq('id', bookingId).single()
  if (error || !booking) return { success: false, error: 'Booking not found.' }
  if (booking.status !== 'confirmed' && booking.status !== 'cancelled') {
    return { success: false, error: 'Only confirmed or cancelled bookings can be retried.' }
  }

  try {
    if (channel === 'calendar') {
      const synced = booking.status === 'cancelled'
        ? await deleteGcalEvent(booking)
        : await pushGcalEvent(booking.id)
      if (!synced) return { success: false, error: 'Connect Google Calendar in Settings first.' }
    } else {
      if (!booking.customer_email) return { success: false, error: 'This booking has no email address.' }
      if (booking.status === 'cancelled') await sendCancelEmail(booking)
      else await sendConfirmEmail(booking)
    }
    return { success: true }
  } catch {
    return { success: false, error: channel === 'calendar' ? 'Calendar sync failed. Check the connection in Settings and retry.' : 'Email could not be sent. Check the recipient and sender settings before retrying.' }
  }
}
