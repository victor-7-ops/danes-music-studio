import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('@/lib/supabase/serviceClient', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/gcal/client', () => ({ getGcalClient: vi.fn(), registerWatchChannel: vi.fn(), stopWatchChannel: vi.fn() }))
import { createServiceClient } from '@/lib/supabase/serviceClient'
import { getGcalClient, registerWatchChannel } from '@/lib/gcal/client'
import { POST } from '@/app/api/cron/gcal-renew/route'
import { makeMockClient } from './supabaseMock'

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('CRON_SECRET', 'test')
  vi.stubEnv('GOOGLE_REDIRECT_URI', 'https://studio.example/api/auth/google/callback')
})
afterEach(() => vi.unstubAllEnvs())
it('rejects unauthorized requests before loading Google credentials', async () => {
  expect((await POST(new Request('https://studio.example'))).status).toBe(403)
  expect(getGcalClient).not.toHaveBeenCalled()
})
it.each([false, true])('persists the watch without browser cookies and checks DB errors (failure=%s)', async (failed) => {
  vi.mocked(getGcalClient).mockResolvedValue({ googleTokensRow: { id: 'connection' } } as never)
  vi.mocked(registerWatchChannel).mockResolvedValue({ channelId: 'watch', resourceId: 'resource', expiration: '1800000000000' })
  const db = makeMockClient({ google_tokens: [{ data: null, error: failed ? new Error('persist failed') : null }] })
  vi.mocked(createServiceClient).mockReturnValue(db as never)
  const response = await POST(new Request('https://studio.example', { method: 'POST', headers: { 'x-cron-secret': 'test' } }))
  expect(response.status).toBe(failed ? 500 : 200)
  expect(db.from.mock.results[0].value.eq).toHaveBeenCalledWith('id', 'connection')
})
