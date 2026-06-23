// src/lib/emails/confirm.ts
// Sends booking confirmation email via Resend. Called by the PayMongo webhook handler.

import { resend } from './resend'
import { buildConfirmHtml } from './templates/confirm.html'
import type { Tables } from '@/types/database'

type ConfirmBooking = Pick<
  Tables<'bookings'>,
  | 'confirmation_code'
  | 'customer_email'
  | 'customer_name'
  | 'band_name'
  | 'start_at'
  | 'end_at'
  | 'total_amount'
  | 'amount_paid'
>

export async function sendConfirmEmail(booking: ConfirmBooking): Promise<void> {
  const html = buildConfirmHtml(booking)

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'noreply@danesmusicstudio.com',
    to: booking.customer_email,
    subject: `Booking Confirmed — ${booking.confirmation_code}`,
    html,
  })

  if (error) {
    // T-04-02: log error object only — never log customer_email or booking fields
    console.error('[email] confirm send failed:', error)
  }
}
