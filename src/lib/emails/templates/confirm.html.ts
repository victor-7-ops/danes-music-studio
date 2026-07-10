// src/lib/emails/templates/confirm.html.ts
// Booking confirmation email template. Inline styles only — email clients strip external CSS.

import { formatPHP, formatManila } from '../format'

export function buildConfirmHtml(booking: {
  confirmation_code: string
  customer_name: string
  band_name: string | null
  start_at: string
  end_at: string
  total_amount: number
  amount_paid: number
  cancel_token?: string
}): string {
  const displayName = booking.band_name ?? booking.customer_name
  const dateTime =
    formatManila(booking.start_at, 'datetime') +
    ' – ' +
    formatManila(booking.end_at, 'time')
  const total = formatPHP(booking.total_amount)
  const balance = formatPHP(booking.total_amount - booking.amount_paid)
  const baseUrl = process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000'
  const manageUrl = booking.cancel_token
    ? `${baseUrl}/booking/${booking.confirmation_code}?token=${booking.cancel_token}`
    : null

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">

          <!-- Wordmark -->
          <tr>
            <td style="padding-bottom:24px;">
              <span style="font-weight:900;font-size:24px;letter-spacing:0.15em;text-transform:uppercase;color:#111111;">DANES</span>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="border-top:2px solid #111111;padding-bottom:32px;"></td>
          </tr>

          <!-- Label -->
          <tr>
            <td style="font-size:13px;letter-spacing:0.1em;text-transform:uppercase;color:#999999;padding-bottom:12px;">
              Booking Confirmed
            </td>
          </tr>

          <!-- Confirmation code -->
          <tr>
            <td style="font-size:36px;font-weight:700;color:#111111;padding-bottom:8px;">
              ${booking.confirmation_code}
            </td>
          </tr>

          <!-- Display name -->
          <tr>
            <td style="font-size:16px;color:#111111;padding-bottom:24px;">
              ${displayName}
            </td>
          </tr>

          <!-- Date / time -->
          <tr>
            <td style="font-size:15px;color:#111111;padding-bottom:16px;">
              ${dateTime}
            </td>
          </tr>

          <!-- Divider hairline -->
          <tr>
            <td style="border-top:1px solid #e5e5e5;padding-bottom:16px;"></td>
          </tr>

          <!-- Total -->
          <tr>
            <td style="font-size:15px;color:#111111;padding-bottom:8px;">
              <span style="color:#999999;">Total: </span>${total}
            </td>
          </tr>

          <!-- Balance due -->
          <tr>
            <td style="font-size:15px;color:#111111;padding-bottom:40px;">
              <span style="color:#999999;">Balance due: </span>${balance}
            </td>
          </tr>

          ${manageUrl ? `
          <!-- Manage link -->
          <tr>
            <td style="padding-bottom:24px;">
              <a href="${manageUrl}" style="font-size:14px;color:#111111;text-decoration:underline;">Manage or cancel this booking</a>
            </td>
          </tr>` : ''}

          <!-- Footer hairline -->
          <tr>
            <td style="border-top:1px solid #e5e5e5;padding-top:24px;">
              <span style="font-size:12px;color:#999999;">Danes Music Studio &middot; Pardo, Cebu City</span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
