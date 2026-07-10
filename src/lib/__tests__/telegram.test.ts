import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  sendTelegramMessage,
  newPendingBookingMessage,
  paymentConfirmedMessage,
  paymentProofUploadedMessage,
} from '../telegram'

describe('sendTelegramMessage', () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN
  const originalChatId = process.env.TELEGRAM_CHAT_ID

  afterEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = originalToken
    process.env.TELEGRAM_CHAT_ID = originalChatId
    vi.restoreAllMocks()
  })

  it('no-ops without TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID set', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN
    delete process.env.TELEGRAM_CHAT_ID
    const fetchSpy = vi.spyOn(global, 'fetch')
    await sendTelegramMessage('hello')
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('newPendingBookingMessage', () => {
  it('escapes HTML in band/customer name and shows deposit amount due', () => {
    const msg = newPendingBookingMessage({
      confirmationCode: 'DMS-AB12',
      customerName: 'Vic <script>',
      bandName: 'The & Co',
      startAt: '2026-07-11T14:00:00+08:00',
      endAt: '2026-07-11T16:00:00+08:00',
      totalAmount: 200000,
      depositAmount: 100000,
      paymentMethod: 'deposit',
    })
    expect(msg).toContain('DMS-AB12')
    expect(msg).toContain('The &amp; Co')
    expect(msg).toContain('Vic &lt;script&gt;')
    expect(msg).toContain('₱1,000')
    expect(msg).not.toContain('<script>')
  })

  it('shows full total when paymentMethod is full', () => {
    const msg = newPendingBookingMessage({
      confirmationCode: 'DMS-CD34',
      customerName: 'Jam Band',
      bandName: null,
      startAt: '2026-07-11T14:00:00+08:00',
      endAt: '2026-07-11T15:00:00+08:00',
      totalAmount: 35000,
      depositAmount: 17500,
      paymentMethod: 'full',
    })
    expect(msg).toContain('₱350')
    expect(msg).not.toContain('₱175')
  })
})

describe('paymentConfirmedMessage', () => {
  it('includes confirmation code and amount', () => {
    const msg = paymentConfirmedMessage({
      confirmationCode: 'DMS-EF56',
      customerName: 'Jane',
      bandName: null,
      amountPaid: 100000,
    })
    expect(msg).toContain('DMS-EF56')
    expect(msg).toContain('₱1,000')
  })
})

describe('paymentProofUploadedMessage', () => {
  it('lists one line per booking', () => {
    const msg = paymentProofUploadedMessage([
      { confirmationCode: 'DMS-GH78', customerName: 'A', bandName: null },
      { confirmationCode: 'DMS-IJ90', customerName: 'B', bandName: 'Band B' },
    ])
    expect(msg.split('\n')).toHaveLength(3) // header + 2 bookings
    expect(msg).toContain('DMS-GH78')
    expect(msg).toContain('DMS-IJ90')
    expect(msg).toContain('Band B')
  })
})
