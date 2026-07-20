import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { createClient } from '@/lib/supabase/server'
import { createBooking, type CreateBookingParams } from '@/lib/actions/createBooking'
import { makeMockClient } from './supabaseMock'

const baseParams: CreateBookingParams = {
  date: '2026-08-01',
  start: '10:00',
  end: '12:00',
  service: 'rehearsal',
  payment: 'deposit',
  contactName: 'Jane Doe',
  email: 'jane@example.com',
  phone: '09171234567',
  bandName: 'The Band',
}

const serviceType = { id: 'svc-1', rate_per_hour: 50000, deposit_pct: 0.5 }
const settings = { hold_window_minutes: 30 }

describe('createBooking', () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset()
  })

  it('happy path: inserts booking with server-computed pricing, no equipment', async () => {
    const client = makeMockClient({
      service_types: [{ data: serviceType, error: null }],
      settings: [{ data: settings, error: null }],
      bookings: [
        { data: { id: 'booking-1' }, error: null },
      ],
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createBooking(baseParams)

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.code).toMatch(/^DMS-[A-Z0-9]{4}$/)
    }

    // Verify the insert call actually carried server-computed amounts, not
    // client-trusted values — this is the DB-mutating assertion the plan
    // calls out (not just "no error thrown").
    expect(client.from).toHaveBeenCalledWith('bookings')
    const bookingsCall = vi.mocked(client.from).mock.results.find(
      (_r, i) => vi.mocked(client.from).mock.calls[i][0] === 'bookings'
    )
    expect(bookingsCall).toBeDefined()
    const insertMock = bookingsCall!.value.insert as ReturnType<typeof vi.fn>
    expect(insertMock).toHaveBeenCalledTimes(1)
    const insertedRow = insertMock.mock.calls[0][0]
    // 2 hours * 50000 rate = 100000 total, 50% deposit = 50000
    expect(insertedRow.total_amount).toBe(100000)
    expect(insertedRow.deposit_amount).toBe(50000)
    expect(insertedRow.amount_paid).toBe(0)
    expect(insertedRow.status).toBe('pending')
    expect(insertedRow.customer_email).toBe('jane@example.com')
  })

  it('rejects when requested equipment has no free unit for the time range', async () => {
    // Fast-path check (step 5b) already sees the conflict via the
    // booking_equipment/bookings join query, before the authoritative
    // reserve_equipment RPC (step 8b, plan 016) is ever called.
    const equipment = [{ id: 'eq-1', name: 'Drum Kit', price_per_session: 5000, quantity: 1 }]
    const client = makeMockClient({
      service_types: [{ data: serviceType, error: null }],
      settings: [{ data: settings, error: null }],
      equipment: [{ data: equipment, error: null }],
      booking_equipment: [
        {
          data: [
            {
              equipment_id: 'eq-1',
              bookings: { status: 'confirmed', start_at: '2026-08-01T09:00:00+08:00', end_at: '2026-08-01T11:00:00+08:00' },
            },
          ],
          error: null,
        },
      ],
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createBooking({ ...baseParams, equipmentIds: ['eq-1'] })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('Drum Kit')
      expect(result.error).toContain('unavailable')
    }
    // Must not have reached the bookings insert step.
    expect(vi.mocked(client.from).mock.calls.some(c => c[0] === 'bookings')).toBe(false)
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('allows booking when equipment usage does not overlap the requested time', async () => {
    // Fast-path check passes (no overlap), then the authoritative
    // reserve_equipment RPC (plan 016) is called and returns no unavailable
    // rows, so the booking succeeds.
    const equipment = [{ id: 'eq-1', name: 'Drum Kit', price_per_session: 5000, quantity: 1 }]
    const client = makeMockClient(
      {
        service_types: [{ data: serviceType, error: null }],
        settings: [{ data: settings, error: null }],
        equipment: [{ data: equipment, error: null }],
        booking_equipment: [
          {
            data: [
              {
                equipment_id: 'eq-1',
                bookings: { status: 'confirmed', start_at: '2026-08-01T06:00:00+08:00', end_at: '2026-08-01T08:00:00+08:00' },
              },
            ],
            error: null,
          },
        ],
        bookings: [{ data: { id: 'booking-2' }, error: null }],
      },
      { rpc: { reserve_equipment: [{ data: [], error: null }] } }
    )
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createBooking({ ...baseParams, equipmentIds: ['eq-1'] })

    expect(result.success).toBe(true)
    expect(client.rpc).toHaveBeenCalledWith('reserve_equipment', expect.objectContaining({ p_booking_id: 'booking-2' }))
  })

  it('surfaces the DB exclusion-constraint overlap error as a friendly message', async () => {
    const client = makeMockClient({
      service_types: [{ data: serviceType, error: null }],
      settings: [{ data: settings, error: null }],
      bookings: [
        {
          data: null,
          error: { message: 'conflicting key value violates exclusion constraint "bookings_no_overlap"' },
        },
      ],
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createBooking(baseParams)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('That time slot was just taken. Please choose different hours.')
    }
  })

  it('rejects invalid params before touching the database', async () => {
    const client = makeMockClient({})
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createBooking({ ...baseParams, email: 'not-an-email' })

    expect(result.success).toBe(false)
    expect(client.from).not.toHaveBeenCalled()
  })
})
