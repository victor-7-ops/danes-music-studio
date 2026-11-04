import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/serviceClient', () => ({ createServiceClient: vi.fn() }))

import { createServiceClient } from '@/lib/supabase/serviceClient'
import { createRecurringBooking, type CreateRecurringBookingParams } from '@/lib/actions/createRecurringBooking'

const rpc = vi.fn()
const client = { rpc }
const baseParams: CreateRecurringBookingParams = {
  date: '2030-08-03', start: '10:00', end: '12:00', service: 'rehearsal',
  payment: 'deposit', contactName: 'Jane Doe', email: 'jane@example.com',
  phone: '09171234567', bandName: 'The Band', occurrenceCount: 4,
}

describe('createRecurringBooking atomic RPC boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createServiceClient).mockReturnValue(client as never)
  })

  it('sends all weekly occurrences to one transaction and returns each capability', async () => {
    rpc.mockResolvedValue({ data: {
      codes: ['DMS-A','DMS-B','DMS-C','DMS-D'], tokens: ['a','b','c','d'], hold_expires_at: '2030-08-03T02:30:00Z',
    }, error: null })
    const result = await createRecurringBooking(baseParams)
    expect(result).toEqual({ success: true, codes: ['DMS-A','DMS-B','DMS-C','DMS-D'], tokens: ['a','b','c','d'], holdExpiresAt: '2030-08-03T02:30:00Z' })
    const request = rpc.mock.calls[0][1].p_request
    expect(request.occurrence_count).toBe(4)
    expect(request.occurrences.map((row: { date: string }) => row.date)).toEqual(['2030-08-03','2030-08-10','2030-08-17','2030-08-24'])
    expect(request.occurrences[0].start_at).toBe('2030-08-03T10:00:00+08:00')
  })

  it('rejects invalid count and malformed runtime data before database access', async () => {
    expect((await createRecurringBooking({ ...baseParams, occurrenceCount: 27 })).success).toBe(false)
    expect((await createRecurringBooking({ ...baseParams, start: '10:30' })).success).toBe(false)
    expect(createServiceClient).not.toHaveBeenCalled()
  })

  it('reports a schedule or room conflict without claiming a partial series', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'slot_blocked' } })
    expect(await createRecurringBooking(baseParams)).toEqual({ success: false, error: 'One or more occurrences are unavailable. Please choose another time.' })
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})
