import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/supabase/serviceClient', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/emails/reminder', () => ({ sendReminderEmail: vi.fn() }))
import { createServiceClient } from '@/lib/supabase/serviceClient'
import { sendReminderEmail } from '@/lib/emails/reminder'
import { POST } from '@/app/api/cron/reminder/route'
import { makeMockClient } from './supabaseMock'

describe('reminder cron', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('CRON_SECRET', 'test-secret') })
  afterEach(() => vi.unstubAllEnvs())
  const request = () => new Request('https://studio.example/api/cron/reminder', { method: 'POST', headers: { 'x-cron-secret': 'test-secret' } })
  it('rejects unauthenticated requests before database access', async () => {
    expect((await POST(new Request('https://studio.example'))).status).toBe(401)
    expect(createServiceClient).not.toHaveBeenCalled()
  })
  it('honors the disabled setting without claiming reminders', async () => {
    const db = makeMockClient({ settings: [{ data: { reminder_enabled: false }, error: null }] })
    vi.mocked(createServiceClient).mockReturnValue(db as never)
    expect((await POST(request())).status).toBe(200)
    expect(db.rpc).not.toHaveBeenCalled()
  })
  it.each([false, true])('persists delivery or releases its own lease (failure=%s)', async (failed) => {
    const db = makeMockClient({
      settings: [{ data: { reminder_enabled: true }, error: null }],
      bookings: [{ data: { id: 'test-id' }, error: null }],
    }, { rpc: { claim_booking_reminders: [{ data: [{ id: 'test-id', reminder_claimed_at: 'lease' }], error: null }] } })
    vi.mocked(createServiceClient).mockReturnValue(db as never)
    if (failed) vi.mocked(sendReminderEmail).mockRejectedValue(new Error('provider failure'))
    const response = await POST(request())
    expect(response.status).toBe(failed ? 502 : 200)
    const update = db.from.mock.results[1].value
    expect(update.update).toHaveBeenCalledWith(failed ? { reminder_claimed_at: null } : { reminder_sent: true, reminder_claimed_at: null })
    expect(update.eq).toHaveBeenCalledWith('reminder_claimed_at', 'lease')
  })
})
