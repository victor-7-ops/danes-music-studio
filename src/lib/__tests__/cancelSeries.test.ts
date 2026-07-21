import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/emails/cancel', () => ({ sendCancelEmail: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/gcal/pushSync', () => ({ deleteGcalEvent: vi.fn().mockResolvedValue(undefined) }))

import { createClient } from '@/lib/supabase/server'
import { cancelSeries } from '@/lib/actions/admin/cancelSeries'
import { sendCancelEmail } from '@/lib/emails/cancel'
import { deleteGcalEvent } from '@/lib/gcal/pushSync'
import { makeMockClient } from './supabaseMock'

// cancelSeries loops the existing per-row cancelBooking() logic (unmodified,
// see src/lib/actions/admin/cancelBooking.ts), which itself calls
// createClient() again for each row's fetch+update. All calls in this test
// resolve against the SAME mock client instance, with a shared `bookings`
// queue consumed in call order: 1 fetch-by-series-id, then per-row
// (fetch, update) pairs from cancelBooking.
describe('cancelSeries', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
    vi.mocked(sendCancelEmail).mockClear()
    vi.mocked(deleteGcalEvent).mockClear()
  })

  it('cancels every occurrence in the series, firing per-occurrence side effects', async () => {
    const seriesBookings = [
      { id: 'b1', status: 'pending' },
      { id: 'b2', status: 'confirmed' },
    ]
    const b1Full = {
      id: 'b1',
      status: 'pending',
      confirmation_code: 'DMS-AAAA',
      customer_email: 'jane@example.com',
      customer_name: 'Jane Doe',
      band_name: null,
      start_at: '2026-08-01T10:00:00+08:00',
      gcal_event_id: null,
    }
    const b2Full = {
      id: 'b2',
      status: 'confirmed',
      confirmation_code: 'DMS-BBBB',
      customer_email: 'jane@example.com',
      customer_name: 'Jane Doe',
      band_name: null,
      start_at: '2026-08-08T10:00:00+08:00',
      gcal_event_id: 'gcal-evt-2',
    }

    const client = makeMockClient({
      bookings: [
        { data: seriesBookings, error: null }, // cancelSeries's lookup
        { data: b1Full, error: null }, // cancelBooking(b1) fetch
        { data: null, error: null }, // cancelBooking(b1) update
        { data: b2Full, error: null }, // cancelBooking(b2) fetch
        { data: null, error: null }, // cancelBooking(b2) update
      ],
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await cancelSeries('series-1')

    expect(result).toEqual({ success: true, cancelled: 2, failed: [] })
    expect(sendCancelEmail).toHaveBeenCalledTimes(1) // only b2 was confirmed
    expect(sendCancelEmail).toHaveBeenCalledWith(b2Full)
    expect(deleteGcalEvent).toHaveBeenCalledWith('gcal-evt-2')
  })

  it('skips rows already cancelled without invoking cancelBooking for them', async () => {
    const seriesBookings = [{ id: 'b1', status: 'cancelled' }]
    const client = makeMockClient({
      bookings: [{ data: seriesBookings, error: null }],
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await cancelSeries('series-1')

    expect(result).toEqual({ success: true, cancelled: 0, failed: [] })
    // Only the series lookup — no cancelBooking fetch/update pair issued.
    expect(vi.mocked(client.from).mock.calls.filter(c => c[0] === 'bookings')).toHaveLength(1)
  })

  it('returns not-found when the series has no matching bookings', async () => {
    const client = makeMockClient({
      bookings: [{ data: [], error: null }],
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await cancelSeries('missing-series')

    expect(result).toEqual({ success: false, error: 'Series not found', cancelled: 0, failed: [] })
  })

  it('requires an authenticated user', async () => {
    const client = makeMockClient({}, { user: null })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await cancelSeries('series-1')

    expect(result).toEqual({ success: false, error: 'Unauthorized', cancelled: 0, failed: [] })
    expect(client.from).not.toHaveBeenCalled()
  })
})
