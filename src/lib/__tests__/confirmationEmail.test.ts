import { expect, it } from 'vitest'
import { buildConfirmHtml } from '@/lib/emails/templates/confirm.html'

it('escapes customer text and keeps the full reference in a wrapping block', () => {
  const code = 'DMS-157FC467E21D4F77B58DF8EF87025FAF'
  const html = buildConfirmHtml({ confirmation_code: code, customer_name: 'Test', band_name: '<img src=x> & friends', start_at: '2026-11-06T01:00:00Z', end_at: '2026-11-06T02:00:00Z', total_amount: 35000, amount_paid: 35000 })
  expect(html).toContain('&lt;img src=x&gt; &amp; friends')
  expect(html).not.toContain('<img src=x>')
  expect(html).toContain(code)
  expect(html).toContain('word-break:break-all')
  expect(html).toContain('₱350')
})
