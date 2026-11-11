import { expect, it, vi } from 'vitest'
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
import { createClient } from '@/lib/supabase/server'
import { updateSettings } from '@/lib/actions/admin/updateSettings'
import { makeMockClient } from './supabaseMock'
const params = { operatingOpen: '09:00', operatingClose: '22:00', holdWindowMinutes: 15, defaultDepositPct: 30, reminderEnabled: true, ratePerHour: 50000, gcashQrUrl: '', bankName: '', accountName: '', accountNumber: '', termsAndConditions: '' }
it.each([null, { message: 'transaction failed' }])('saves settings and pricing in one transaction (%j)', async error => {
  const db = makeMockClient({}, { rpc: { update_studio_settings: [{ data: null, error }] } })
  vi.mocked(createClient).mockResolvedValue(db as never)
  expect(await updateSettings(params)).toEqual(error ? { success: false, error: error.message } : { success: true })
  expect(db.from).not.toHaveBeenCalled()
  expect(db.rpc).toHaveBeenCalledWith('update_studio_settings', { p_settings: expect.objectContaining({ default_deposit_pct: 0.3, rate_per_hour: 50000 }) })
})
it('rejects an unauthorized settings transaction', async () => {
  const db = makeMockClient({}, { user: null })
  vi.mocked(createClient).mockResolvedValue(db as never)
  expect((await updateSettings(params)).success).toBe(false)
  expect(db.rpc).not.toHaveBeenCalled()
})
