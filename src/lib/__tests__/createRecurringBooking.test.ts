import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import {
  createRecurringBooking,
  type CreateRecurringBookingParams,
} from '@/lib/actions/createRecurringBooking'
import { makeMockClient } from './supabaseMock'

const baseParams: CreateRecurringBookingParams = {
  date: '2026-08-01', // Saturday
  start: '10:00',
  end: '12:00',
  service: 'rehearsal',
  payment: 'deposit',
  contactName: 'Jane Doe',
  email: 'jane@example.com',
  phone: '09171234567',
  bandName: 'The Band',
  occurrenceCount: 4,
}

const serviceType = { id: 'svc-1', rate_per_hour: 50000, deposit_pct: 0.5 }
const settings = { hold_window_minutes: 30 }

describe('createRecurringBooking', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
  })

  it('happy path: inserts 1 series row + N booking rows with correct weekly dates', async () => {
    const insertedRows = Array.from({ length: 4 }, (_, i) => ({
      id: `booking-${i}`,
      start_at: `2026-08-${String(1 + i * 7).padStart(2, '0')}T10:00:00+08:00`,
      end_at: `2026-08-${String(1 + i * 7).padStart(2, '0')}T12:00:00+08:00`,
    }))

    const client = makeMockClient({
      service_types: [{ data: serviceType, error: null }],
      settings: [{ data: settings, error: null }],
      bookings: [
        { data: [], error: null }, // pre-check: no existing bookings
        { data: insertedRows, error: null }, // bulk insert
      ],
      booking_series: [{ data: { id: 'series-1' }, error: null }],
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createRecurringBooking(baseParams)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.codes).toHaveLength(4)
      result.codes.forEach(code => expect(code).toMatch(/^DMS-[A-Z0-9]{4}$/))
    }

    // booking_series insert happened with occurrence_count
    const seriesCallIndex = vi.mocked(client.from).mock.calls.findIndex(c => c[0] === 'booking_series')
    expect(seriesCallIndex).toBeGreaterThanOrEqual(0)
    const seriesBuilder = vi.mocked(client.from).mock.results[seriesCallIndex].value
    expect(seriesBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ recurrence_pattern: 'weekly', occurrence_count: 4 })
    )

    // bookings bulk insert carried 4 rows, all with series_id + correct dates
    const bookingsInsertCall = vi
      .mocked(client.from).mock.calls
      .map((c, i) => ({ table: c[0], result: vi.mocked(client.from).mock.results[i].value }))
      .filter(c => c.table === 'bookings')[0] // first .from('bookings') call = pre-check (no insert)
    // second bookings call is the insert
    const bookingsCalls = vi
      .mocked(client.from).mock.calls
      .map((c, i) => ({ table: c[0], result: vi.mocked(client.from).mock.results[i].value }))
      .filter(c => c.table === 'bookings')
    expect(bookingsCalls).toHaveLength(2)
    const insertMock = bookingsCalls[1].result.insert as ReturnType<typeof vi.fn>
    expect(insertMock).toHaveBeenCalledTimes(1)
    const insertedArg = insertMock.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(insertedArg).toHaveLength(4)
    expect(insertedArg[0].series_id).toBe('series-1')
    expect(insertedArg[0].start_at).toBe('2026-08-01T10:00:00+08:00')
    expect(insertedArg[1].start_at).toBe('2026-08-08T10:00:00+08:00')
    expect(insertedArg[2].start_at).toBe('2026-08-15T10:00:00+08:00')
    expect(insertedArg[3].start_at).toBe('2026-08-22T10:00:00+08:00')
    expect(insertedArg[0].total_amount).toBe(100000)
    expect(insertedArg[0].deposit_amount).toBe(50000)
  })

  it('rejects the whole series when a single occurrence conflicts, inserting nothing', async () => {
    const client = makeMockClient({
      service_types: [{ data: serviceType, error: null }],
      settings: [{ data: settings, error: null }],
      bookings: [
        {
          // Existing booking overlapping week 3 (2026-08-15 10:00-12:00)
          data: [{ start_at: '2026-08-15T10:00:00+08:00', end_at: '2026-08-15T12:00:00+08:00' }],
          error: null,
        },
      ],
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createRecurringBooking(baseParams)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.conflicts).toContain('2026-08-15')
    }
    // Must not have reached booking_series or the bookings insert.
    expect(vi.mocked(client.from).mock.calls.some(c => c[0] === 'booking_series')).toBe(false)
    const bookingsCalls = vi.mocked(client.from).mock.calls.filter(c => c[0] === 'bookings')
    expect(bookingsCalls).toHaveLength(1) // only the pre-check read, no insert
  })

  it('rejects the whole series and rolls back when equipment is unavailable for one occurrence', async () => {
    const equipment = [{ id: 'eq-1', name: 'Drum Kit', price_per_session: 5000, quantity: 1 }]
    const insertedRows = Array.from({ length: 4 }, (_, i) => ({
      id: `booking-${i}`,
      start_at: `2026-08-${String(1 + i * 7).padStart(2, '0')}T10:00:00+08:00`,
      end_at: `2026-08-${String(1 + i * 7).padStart(2, '0')}T12:00:00+08:00`,
    }))

    const client = makeMockClient({
      service_types: [{ data: serviceType, error: null }],
      settings: [{ data: settings, error: null }],
      equipment: [{ data: equipment, error: null }],
      bookings: [
        { data: [], error: null }, // date pre-check clean
      ],
      booking_equipment: [
        {
          // Existing equipment usage overlapping week 2 (2026-08-08)
          data: [
            {
              equipment_id: 'eq-1',
              bookings: {
                status: 'confirmed',
                start_at: '2026-08-08T10:00:00+08:00',
                end_at: '2026-08-08T12:00:00+08:00',
              },
            },
          ],
          error: null,
        },
      ],
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createRecurringBooking({ ...baseParams, equipmentIds: ['eq-1'] })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.conflicts).toContain('2026-08-08')
    }
    // Never reached series/bookings insert.
    expect(vi.mocked(client.from).mock.calls.some(c => c[0] === 'booking_series')).toBe(false)
    void insertedRows // referenced for readability; not used once pre-check rejects
  })
})
