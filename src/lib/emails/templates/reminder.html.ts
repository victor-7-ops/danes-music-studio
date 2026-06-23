// src/lib/emails/templates/reminder.html.ts
// Session reminder email template (sent ~24h before session via cron).
// Inline styles only — email clients strip external CSS.

import { formatManila } from '../format'

const STUDIO_ADDRESS = 'Danes Music Studio · Pardo, Cebu City'

export function buildReminderHtml(booking: {
  confirmation_code: string
  customer_name: string
  band_name: string | null
  start_at: string
  end_at: string
}): string {
  const timeStr = formatManila(booking.start_at, 'time')

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

          <!-- Reminder message -->
          <tr>
            <td style="font-size:15px;color:#111111;line-height:1.6;padding-bottom:16px;">
              Your session is tomorrow at <strong>${timeStr}</strong>.
            </td>
          </tr>

          <!-- Studio address -->
          <tr>
            <td style="font-size:15px;color:#111111;padding-bottom:16px;">
              ${STUDIO_ADDRESS}
            </td>
          </tr>

          <!-- Reference -->
          <tr>
            <td style="font-size:13px;color:#999999;padding-bottom:40px;">
              Booking reference: ${booking.confirmation_code}
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
