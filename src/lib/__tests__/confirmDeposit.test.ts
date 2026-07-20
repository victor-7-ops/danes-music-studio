import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/gcal/pushSync', () => ({ pushGcalEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/emails/confirm', () => ({ sendConfirmEmail: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/telegram', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue(undefined),
  paymentConfirmedMessage: vi.fn(() => 'msg'),
}))

import { createClient } from '@/lib/supabase/server'
import { confirmDeposit } from '@/lib/actions/admin/confirmDeposit'
import { makeMockClient } from './supabaseMock'

describe('confirmDeposit', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
  })

  it('happy path: flips status to confirmed and records amount_paid', async () => {
    const updatedRow = {
      confirmation_code: 'DMS-AB12',
      customer_email: 'jane@example.com',
      customer_name: 'Jane Doe',
      band_name: 'The Band',
      start_at: '2026-08-01T10:00:00+08:00',
      end_at: '2026-08-01T12:00:00+08:00',
      total_amount: 100000,
      amount_paid: 50000,
      cancel_token: 'tok',
    }
    const client = makeMockClient({
      bookings: [{ data: updatedRow, error: null }],
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await confirmDeposit('booking-1', 50000)

    expect(result.success).toBe(true)

    // Assert the DB-mutating call itself, not just the return value.
    const bookingsCallIndex = vi.mocked(client.from).mock.calls.findIndex(c => c[0] === 'bookings')
    expect(bookingsCallIndex).toBeGreaterThanOrEqual(0)
    const builder = vi.mocked(client.from).mock.results[bookingsCallIndex].value
    expect(builder.update).toHaveBeenCalledWith({ status: 'confirmed', amount_paid: 50000 })
    // Guard against re-confirming an already-cancelled booking.
    expect(builder.neq).toHaveBeenCalledWith('status', 'cancelled')
  })

  it('rejects a negative amount without touching the database', async () => {
    const client = makeMockClient({})
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await confirmDeposit('booking-1', -5)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid amount.')
    expect(client.from).not.toHaveBeenCalled()
  })

  it('rejects an already-cancelled booking (neq guard yields no row -> error)', async () => {
    const client = makeMockClient({
      bookings: [
        {
          data: null,
          error: { message: 'JSON object requested, multiple (or no) rows returned' },
        },
      ],
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await confirmDeposit('booking-1', 50000)

    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('requires an authenticated user', async () => {
    const client = makeMockClient({}, { user: null })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await confirmDeposit('booking-1', 50000)

    expect(result).toEqual({ success: false, error: 'Unauthorized' })
    expect(client.from).not.toHaveBeenCalled()
  })
})
