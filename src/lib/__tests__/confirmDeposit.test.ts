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
import { pushGcalEvent } from '@/lib/gcal/pushSync'
import { makeMockClient } from './supabaseMock'

describe('confirmDeposit', () => {
  it('preserves the confirmed payment and reports a failed Calendar delivery', async () => {
    const client = makeMockClient({ bookings: [
      { data: { total_amount: 35000, amount_paid: 0, status: 'pending' }, error: null },
      { data: { confirmation_code: 'TEST', amount_paid: 35000 }, error: null },
    ] })
    vi.mocked(createClient).mockResolvedValue(client as never)
    vi.mocked(pushGcalEvent).mockRejectedValueOnce(new Error('Calendar unavailable'))
    const result = await confirmDeposit('booking-1', 35000)
    expect(result.success).toBe(true)
    expect(result.warning).toContain('Calendar sync failed')
  })
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
      bookings: [
        { data: { total_amount: 100000, amount_paid: 0, status: 'pending' }, error: null },
        { data: updatedRow, error: null },
      ],
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await confirmDeposit('booking-1', 50000)

    expect(result.success).toBe(true)

    // Assert the DB-mutating call itself, not just the return value.
    const bookingsCalls = vi.mocked(client.from).mock.calls
      .map((c, i) => ({ call: c, index: i }))
      .filter((c) => c.call[0] === 'bookings')
    expect(bookingsCalls.length).toBe(2)
    const updateBuilder = vi.mocked(client.from).mock.results[bookingsCalls[1].index].value
    expect(updateBuilder.update).toHaveBeenCalledWith({
      status: 'confirmed',
      amount_paid: 50000,
      payment_method: 'deposit',
    })
    // Guard against re-confirming an already-cancelled booking.
    expect(updateBuilder.eq).toHaveBeenCalledWith('status', 'pending')
    expect(updateBuilder.eq).toHaveBeenCalledWith('amount_paid', 0)
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
        { data: { total_amount: 100000, amount_paid: 0, status: 'pending' }, error: null },
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

  it('rejects confirming an online booking with no uploaded payment proof', async () => {
    const client = makeMockClient({ bookings: [
      { data: { total_amount: 35000, amount_paid: 0, status: 'pending', source: 'online', payment_proof_url: null }, error: null },
    ] })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await confirmDeposit('booking-1', 35000)

    expect(result).toEqual({ success: false, error: 'No payment proof has been uploaded for this booking yet.' })
    expect(client.from).toHaveBeenCalledTimes(1)
  })

  it('allows confirming an onsite booking with no payment proof', async () => {
    const client = makeMockClient({ bookings: [
      { data: { total_amount: 35000, amount_paid: 0, status: 'pending', source: 'onsite', payment_proof_url: null }, error: null },
      { data: { confirmation_code: 'DMS-ON1', amount_paid: 35000 }, error: null },
    ] })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await confirmDeposit('booking-1', 35000)

    expect(result.success).toBe(true)
  })

  it('requires an authenticated user', async () => {
    const client = makeMockClient({}, { user: null })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await confirmDeposit('booking-1', 50000)

    expect(result).toEqual({ success: false, error: 'Unauthorized' })
    expect(client.from).not.toHaveBeenCalled()
  })
})


it.each([
  ['confirmed', 35000, 17500],
  ['confirmed', 35000, 35000],
  ['completed', 17500, 35000],
  ['cancelled', 0, 35000],
])('rejects stale payment for %s without updating', async (status, paid, received) => {
  const client = makeMockClient({ bookings: [{ data: { total_amount: 35000, amount_paid: paid, status }, error: null }] })
  vi.mocked(createClient).mockResolvedValue(client as never)
  vi.mocked(pushGcalEvent).mockClear()
  expect((await confirmDeposit('booking', received)).success).toBe(false)
  expect(client.from).toHaveBeenCalledTimes(1)
  expect(pushGcalEvent).not.toHaveBeenCalled()
})

it('stops delivery if a concurrent confirmation wins the conditional update', async () => {
  const client = makeMockClient({ bookings: [
    { data: { total_amount: 35000, amount_paid: 17500, status: 'confirmed' }, error: null },
    { data: null, error: { message: 'No rows' } },
  ] })
  vi.mocked(createClient).mockResolvedValue(client as never)
  vi.mocked(pushGcalEvent).mockClear()
  expect((await confirmDeposit('booking', 35000, 'full')).success).toBe(false)
  const write = client.from.mock.results[1].value
  expect(write.eq).toHaveBeenCalledWith('amount_paid', 17500)
  expect(write.eq).toHaveBeenCalledWith('status', 'confirmed')
  expect(pushGcalEvent).not.toHaveBeenCalled()
})
