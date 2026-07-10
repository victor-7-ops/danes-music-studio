import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/serviceClient'
import { sendCancelEmail } from '@/lib/emails/cancel'
import { deleteGcalEvent } from '@/lib/gcal/pushSync'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.redirect(new URL('/book?error=invalid_link', req.url))
  }

  const supabase = createServiceClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, confirmation_code, customer_email, customer_name, band_name, start_at, gcal_event_id')
    .eq('cancel_token', token)
    .single()

  if (!booking) {
    return NextResponse.redirect(new URL('/book?error=invalid_link', req.url))
  }

  if (booking.status === 'cancelled') {
    return NextResponse.redirect(
      new URL(`/booking/${booking.confirmation_code}?token=${token}&error=already_cancelled`, req.url)
    )
  }

  if (new Date(booking.start_at) <= new Date()) {
    return NextResponse.redirect(
      new URL(`/booking/${booking.confirmation_code}?token=${token}&error=past_booking`, req.url)
    )
  }

  await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id)

  if (booking.status === 'confirmed') {
    sendCancelEmail(booking).catch((err) => console.error('[email:cancel]', err))
  }

  if (booking.gcal_event_id) {
    void deleteGcalEvent(booking.gcal_event_id).catch((err: unknown) => {
      console.error('[gcal:push] self-cancel delete failed', err)
    })
  }

  return NextResponse.redirect(
    new URL(`/booking/${booking.confirmation_code}?token=${token}&cancelled=1`, req.url)
  )
}
