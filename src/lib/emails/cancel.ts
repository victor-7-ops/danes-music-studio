// src/lib/emails/cancel.ts
// Sends booking cancellation email via Resend.
// D-07: exported here but NOT called in Phase 4 — Phase 5 imports and calls this.

import { resend } from './resend'
import { buildCancelHtml } from './templates/cancel.html'
import type { Tables } from '@/types/database'

type CancelBooking = Pick<
  Tables<'bookings'>,
  | 'confirmation_code'
  | 'customer_email'
  | 'customer_name'
  | 'band_name'
  | 'start_at'
>

export async function sendCancelEmail(booking: CancelBooking): Promise<void> {
  const html = buildCancelHtml(booking)

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'noreply@danesmusicstudio.com',
    to: booking.customer_email,
    subject: `Booking Cancelled — ${booking.confirmation_code}`,
    html,
  })

  if (error) {
    // T-04-02: log error object only — never log customer_email or booking fields
    console.error('[email] cancel send failed:', error)
  }
}
