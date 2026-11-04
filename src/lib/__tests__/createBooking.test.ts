import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/serviceClient', () => ({ createServiceClient: vi.fn() }))

import { createServiceClient } from '@/lib/supabase/serviceClient'
import { createBooking, type CreateBookingParams } from '@/lib/actions/createBooking'

const rpc = vi.fn()
const client = { rpc }
const baseParams: CreateBookingParams = {
  date: '2030-08-01', start: '10:00', end: '12:00', service: 'rehearsal',
  payment: 'deposit', contactName: 'Jane Doe', email: 'jane@example.com',
  phone: '09171234567', bandName: 'The Band',
}

describe('createBooking atomic RPC boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createServiceClient).mockReturnValue(client as never)
  })

  it('sends the validated booking request to the atomic DB transaction and returns capabilities', async () => {
    rpc.mockResolvedValue({ data: { codes: ['DMS-0123456789ABCDEF'], tokens: ['token-1'], hold_expires_at: '2030-08-01T02:30:00Z' }, error: null })
    const result = await createBooking(baseParams)
    expect(result).toEqual({ success: true, code: 'DMS-0123456789ABCDEF', token: 'token-1', holdExpiresAt: '2030-08-01T02:30:00Z' })
    expect(rpc).toHaveBeenCalledWith('create_customer_reservations', { p_request: expect.objectContaining({
      date: '2030-08-01', start: '10:00', end: '12:00', service: 'Rehearsal', payment: 'deposit',
      name: 'Jane Doe', equipment_ids: [], occurrence_count: 1,
    }) })
  })

  it('rejects malformed runtime input before creating a privileged client', async () => {
    const result = await createBooking({ ...baseParams, date: '2026-02-30' })
    expect(result).toEqual({ success: false, error: 'Invalid booking parameters.' })
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each(['2000-01-01', '10:30', '12:30'])('rejects invalid schedule input %s', async value => {
    const input = value.includes(':') ? { ...baseParams, start: value } : { ...baseParams, date: value }
    const result = await createBooking(input)
    expect(result.success).toBe(false)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('maps database overlap failures to a useful response', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'conflicting exclusion constraint bookings_no_overlap' } })
    expect(await createBooking(baseParams)).toEqual({ success: false, error: 'That time slot was just taken. Please choose different hours.' })
  })
})
