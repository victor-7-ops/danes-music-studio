import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/gcal/pushSync', () => ({ pushGcalEvent: vi.fn().mockResolvedValue(undefined) }))
import { pushGcalEvent } from '@/lib/gcal/pushSync'

let depositPct = 0.5
const insertMock = vi.fn((booking: { id: string }) => Promise.resolve({ data: booking, error: null }))
const singleMock = vi.fn(() =>
  Promise.resolve({ data: { id: 'svc-1', rate_per_hour: 35000, deposit_pct: depositPct }, error: null })
)
const eqMock = vi.fn(() => ({ single: singleMock }))
const selectMock = vi.fn(() => ({ eq: eqMock }))
const fromMock = vi.fn((table: string) => {
  if (table === 'service_types') return { select: selectMock }
  return { insert: insertMock }
})
const getUserMock = vi.fn(() => Promise.resolve({ data: { user: { id: 'admin-1', app_metadata: { role: 'admin' } } } }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: getUserMock },
      from: fromMock,
    }),
}))

import { createOnsite } from '../actions/admin/createOnsite'

const baseParams = {
  date: '2026-01-01',
  start: '10:00',
  end: '12:00',
  customerName: 'Test Band',
  customerPhone: '09171234567',
  paymentType: 'deposit' as const,
}

describe('createOnsite deposit calculation', () => {
  it('syncs the inserted confirmed booking to Google Calendar', async () => {
    vi.mocked(pushGcalEvent).mockClear()
    await createOnsite(baseParams)
    expect(pushGcalEvent).toHaveBeenCalledWith(
      insertMock.mock.calls.at(-1)?.[0].id
    )
  })

  it('keeps unpaid bookings out of Google Calendar', async () => {
    vi.mocked(pushGcalEvent).mockClear()
    await createOnsite({ ...baseParams, paymentType: 'unpaid' })
    expect(pushGcalEvent).not.toHaveBeenCalled()
  })
  it('uses configured deposit_pct (0.3), not a hardcoded 50%', async () => {
    depositPct = 0.3
    await createOnsite(baseParams)
    const totalAmount = 2 * 35000
    const expectedDeposit = Math.floor(totalAmount * 0.3)
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ deposit_amount: expectedDeposit })
    )
  })

  it('still computes correctly when deposit_pct is 0.5', async () => {
    depositPct = 0.5
    await createOnsite(baseParams)
    const totalAmount = 2 * 35000
    const expectedDeposit = Math.floor(totalAmount * 0.5)
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ deposit_amount: expectedDeposit })
    )
  })
})
