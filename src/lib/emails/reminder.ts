// src/lib/emails/reminder.ts
// Sends session reminder email via Resend. Called by the cron route ~24h before session.

import { resend } from './resend'
import { buildReminderHtml } from './templates/reminder.html'
import type { Tables } from '@/types/database'

type ReminderBooking = Pick<
  Tables<'bookings'>,
  | 'confirmation_code'
  | 'customer_email'
  | 'customer_name'
  | 'band_name'
  | 'start_at'
  | 'end_at'
>

export async function sendReminderEmail(booking: ReminderBooking): Promise<void> {
  const html = buildReminderHtml(booking)

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'noreply@danesmusicstudio.com',
    to: booking.customer_email,
    subject: `Your session tomorrow — ${booking.confirmation_code}`,
    html,
  })

  if (error) {
    // T-04-02: log error object only — never log customer_email or booking fields
    console.error('[email] reminder send failed:', error)
  }
}
