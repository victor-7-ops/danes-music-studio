import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/serviceClient'
import { deleteGcalEvent } from '@/lib/gcal/pushSync'

export const runtime = 'nodejs'

// Simplified vs. berty's reschedule_from chain (which links new->old and defers
// cancelling the old booking until payment confirms): danes has no live online
// payment path right now (PayMongo off, manual QR only), so there is no
// "abandoned reschedule" risk to guard against. The old booking is cancelled
// immediately — the token itself is the trust boundary (unguessable, single
// booking) — and the customer is sent to /book to make a fresh booking.
//
// GET is read-only: it only resolves the token to a confirmation code and
// redirects to the confirm page. The actual cancellation happens in POST,
// so an email link-scanner prefetching this GET can no longer cancel a
// real booking.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.redirect(new URL('/book?error=invalid_link', req.url))
  }

  const supabase = createServiceClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('confirmation_code')
    .eq('cancel_token', token)
    .single()

  if (!booking) {
    return NextResponse.redirect(new URL('/book?error=invalid_link', req.url))
  }

  return NextResponse.redirect(
    new URL(`/booking/${booking.confirmation_code}/reschedule-confirm?token=${token}`, req.url)
  )
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const token = formData.get('token')
  if (typeof token !== 'string' || !token) {
    return NextResponse.redirect(new URL('/book?error=invalid_link', req.url))
  }

  const supabase = createServiceClient()
  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, confirmation_code, start_at, gcal_event_id')
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

  if (booking.gcal_event_id) {
    void deleteGcalEvent(booking.gcal_event_id).catch((err: unknown) => {
      console.error('[gcal:push] reschedule delete failed', err)
    })
  }

  return NextResponse.redirect(
    new URL(`/book?rescheduled_from=${booking.confirmation_code}`, req.url)
  )
}
