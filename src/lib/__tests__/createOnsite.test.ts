import { describe, it, expect, vi, beforeEach } from 'vitest'
vi.mock('@/lib/gcal/pushSync', () => ({ pushGcalEvent: vi.fn().mockResolvedValue(undefined) }))
import { pushGcalEvent } from '@/lib/gcal/pushSync'

const rpcMock = vi.fn(() => Promise.resolve({ data: { id: 'booking-1', code: 'DMS-ABC', status: 'confirmed' }, error: null }))
const getUserMock = vi.fn(() => Promise.resolve({ data: { user: { id: 'admin-1', app_metadata: { role: 'admin' } } } }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: getUserMock },
      rpc: rpcMock,
    }),
}))

import { createOnsite } from '../actions/admin/createOnsite'
import { createWalkIn } from '../actions/admin/createWalkIn'

const baseParams = {
  date: '2026-01-01',
  start: '10:00',
  end: '12:00',
  customerName: 'Test Band',
  customerPhone: '09171234567',
  paymentType: 'deposit' as const,
}

describe('createOnsite', () => {
  beforeEach(() => {
    rpcMock.mockClear()
    rpcMock.mockResolvedValue({ data: { id: 'booking-1', code: 'DMS-ABC', status: 'confirmed' }, error: null })
    vi.mocked(pushGcalEvent).mockClear()
  })

  it('calls the atomic admin booking RPC with mode=onsite', async () => {
    await createOnsite(baseParams)
    expect(rpcMock).toHaveBeenCalledWith('create_admin_booking', { p_request: expect.objectContaining({
      mode: 'onsite', date: '2026-01-01', start: '10:00', end: '12:00',
      service: 'Rehearsal', payment_type: 'deposit', customer_name: 'Test Band',
    }) })
  })

  it('syncs the inserted confirmed booking to Google Calendar', async () => {
    await createOnsite(baseParams)
    expect(pushGcalEvent).toHaveBeenCalledWith('booking-1')
  })

  it('keeps unpaid (pending) bookings out of Google Calendar', async () => {
    rpcMock.mockResolvedValue({ data: { id: 'booking-2', code: 'DMS-DEF', status: 'pending' }, error: null })
    await createOnsite({ ...baseParams, paymentType: 'unpaid' })
    expect(pushGcalEvent).not.toHaveBeenCalled()
  })

  it('surfaces overlap errors from the RPC', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'bookings_no_overlap' } } as never)
    expect(await createOnsite(baseParams)).toEqual({ success: false, error: 'That time slot is already booked.' })
  })

  it('passes through an optional voucher code', async () => {
    await createOnsite({ ...baseParams, voucherCode: 'summer20' })
    expect(rpcMock).toHaveBeenCalledWith('create_admin_booking', { p_request: expect.objectContaining({ voucher_code: 'summer20' }) })
  })
})

// Both admin forms use whole-hour slots; reject minute values before pricing.
describe.each([
  ['onsite', createOnsite],
  ['walk-in', createWalkIn],
] as const)('%s time validation', (_name, create) => {
  beforeEach(() => rpcMock.mockClear())

  it.each([
    ['10:30', '12:00'],
    ['10:00', '12:30'],
    ['25:00', '26:00'],
  ])('rejects %s–%s before calling the RPC', async (start, end) => {
    expect(await create({ ...baseParams, start, end })).toEqual({
      success: false, error: 'Invalid parameters.',
    })
    expect(rpcMock).not.toHaveBeenCalled()
  })
})
