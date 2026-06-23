// src/lib/emails/templates/cancel.html.ts
// Booking cancellation email template. Brief single paragraph per D-05 spec.
// Inline styles only — email clients strip external CSS.

import { formatManila } from '../format'

export function buildCancelHtml(booking: {
  confirmation_code: string
  customer_name: string
  band_name: string | null
  start_at: string
}): string {
  const dateStr = formatManila(booking.start_at, 'date')

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

          <!-- Cancellation message -->
          <tr>
            <td style="font-size:15px;color:#111111;line-height:1.6;padding-bottom:40px;">
              Your booking <strong>${booking.confirmation_code}</strong> on ${dateStr} has been cancelled.
            </td>
          </tr>

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
