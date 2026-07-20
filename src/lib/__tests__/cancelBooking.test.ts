import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/emails/cancel', () => ({ sendCancelEmail: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/gcal/pushSync', () => ({ deleteGcalEvent: vi.fn().mockResolvedValue(undefined) }))

import { createClient } from '@/lib/supabase/server'
import { cancelBooking } from '@/lib/actions/admin/cancelBooking'
import { sendCancelEmail } from '@/lib/emails/cancel'
import { deleteGcalEvent } from '@/lib/gcal/pushSync'
import { makeMockClient } from './supabaseMock'

describe('cancelBooking', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
    vi.mocked(sendCancelEmail).mockClear()
    vi.mocked(deleteGcalEvent).mockClear()
  })

  it('happy path on a confirmed booking: flips status, emails, and deletes the gcal event', async () => {
    const booking = {
      id: 'booking-1',
      status: 'confirmed',
      confirmation_code: 'DMS-AB12',
      customer_email: 'jane@example.com',
      customer_name: 'Jane Doe',
      band_name: 'The Band',
      start_at: '2026-08-01T10:00:00+08:00',
      gcal_event_id: 'gcal-evt-1',
    }
    const client = makeMockClient({
      bookings: [
        { data: booking, error: null },
        { data: null, error: null }, // the update() call
      ],
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await cancelBooking('booking-1')

    expect(result).toEqual({ success: true })

    const bookingsCalls = vi.mocked(client.from).mock.calls
      .map((c, i) => ({ call: c, result: vi.mocked(client.from).mock.results[i].value }))
      .filter(c => c.call[0] === 'bookings')
    expect(bookingsCalls).toHaveLength(2)
    expect(bookingsCalls[1].result.update).toHaveBeenCalledWith({ status: 'cancelled' })

    expect(sendCancelEmail).toHaveBeenCalledWith(booking)
    expect(deleteGcalEvent).toHaveBeenCalledWith('gcal-evt-1')
  })

  it('pending booking cancel is silent: no email, no gcal delete', async () => {
    const booking = {
      id: 'booking-2',
      status: 'pending',
      confirmation_code: 'DMS-CD34',
      customer_email: 'jane@example.com',
      customer_name: 'Jane Doe',
      band_name: null,
      start_at: '2026-08-01T10:00:00+08:00',
      gcal_event_id: null,
    }
    const client = makeMockClient({
      bookings: [
        { data: booking, error: null },
        { data: null, error: null },
      ],
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await cancelBooking('booking-2')

    expect(result).toEqual({ success: true })
    expect(sendCancelEmail).not.toHaveBeenCalled()
    expect(deleteGcalEvent).not.toHaveBeenCalled()
  })

  it('rejects an already-cancelled booking without issuing an update', async () => {
    const booking = { id: 'booking-3', status: 'cancelled' }
    const client = makeMockClient({
      bookings: [{ data: booking, error: null }],
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await cancelBooking('booking-3')

    expect(result).toEqual({ success: false, error: 'Already cancelled' })
    // Only the initial fetch — no second .from('bookings') for the update.
    expect(vi.mocked(client.from).mock.calls.filter(c => c[0] === 'bookings')).toHaveLength(1)
  })

  it('returns not-found when the booking fetch errors', async () => {
    const client = makeMockClient({
      bookings: [{ data: null, error: { message: 'not found' } }],
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await cancelBooking('missing')

    expect(result).toEqual({ success: false, error: 'Booking not found' })
  })

  it('requires an authenticated user', async () => {
    const client = makeMockClient({}, { user: null })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await cancelBooking('booking-1')

    expect(result).toEqual({ success: false, error: 'Unauthorized' })
    expect(client.from).not.toHaveBeenCalled()
  })
})
