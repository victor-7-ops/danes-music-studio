import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeMockClient } from './supabaseMock'

vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/gcal/client', () => ({ createOAuth2Client: vi.fn(), registerWatchChannel: vi.fn() }))
vi.mock('@/lib/gcal/crypto', () => ({ encryptToken: vi.fn(() => 'encrypted') }))

import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createOAuth2Client } from '@/lib/gcal/client'
import { GET } from '@/app/api/auth/google/callback/route'

describe('Google Calendar callback', () => {
  beforeEach(() => {
    vi.mocked(cookies).mockResolvedValue({
      get: () => ({ value: 'test-state' }), delete: vi.fn(),
    } as never)
    vi.mocked(createOAuth2Client).mockReturnValue({
      getToken: vi.fn().mockResolvedValue({ tokens: { access_token: 'access', refresh_token: 'refresh' } }),
      getTokenInfo: vi.fn().mockResolvedValue({ email: 'studio@example.com' }),
    } as never)
  })

  it('reports a failed atomic replacement without deleting saved credentials', async () => {
    const failure = { data: null, error: { message: 'Database failure' } }
    const client = makeMockClient({}, {
      rpc: { replace_google_connection: [failure] },
      user: { id: 'admin', app_metadata: { role: 'admin' } },
    })
    vi.mocked(createClient).mockResolvedValue(client as never)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const response = await GET(new Request('https://studio.example/api/auth/google/callback?code=test&state=test-state'))
      expect(response.headers.get('location')).toBe('https://studio.example/admin/settings?gcal=error')
      expect(client.from).not.toHaveBeenCalled()
      expect(client.rpc).toHaveBeenCalledWith('replace_google_connection', { p_encrypted_token: 'encrypted', p_google_email: 'studio@example.com' })
    } finally {
      log.mockRestore()
    }
  })

  it('rejects missing Google email before modifying saved credentials', async () => {
    vi.mocked(createOAuth2Client).mockReturnValue({
      getToken: vi.fn().mockResolvedValue({ tokens: { access_token: 'access', refresh_token: 'refresh' } }),
      getTokenInfo: vi.fn().mockResolvedValue({}),
    } as never)
    const client = makeMockClient({}, { user: { id: 'admin', app_metadata: { role: 'admin' } } })
    vi.mocked(createClient).mockResolvedValue(client as never)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const response = await GET(new Request('https://studio.example/api/auth/google/callback?code=test&state=test-state'))
      expect(response.headers.get('location')).toContain('gcal=error')
      expect(client.from).not.toHaveBeenCalled()
    } finally {
      log.mockRestore()
    }
  })
})


it('uses one atomic replacement for a successful connection', async () => {
  vi.stubEnv('VERCEL_ENV', 'test')
  vi.mocked(cookies).mockResolvedValue({ get: () => ({ value: 'test-state' }), delete: vi.fn() } as never)
  vi.mocked(createOAuth2Client).mockReturnValue({
    getToken: vi.fn().mockResolvedValue({ tokens: { access_token: 'access', refresh_token: 'refresh' } }),
    getTokenInfo: vi.fn().mockResolvedValue({ email: 'studio@example.com' }),
  } as never)
  const client = makeMockClient({}, { rpc: { replace_google_connection: [{ data: null, error: null }] } })
  vi.mocked(createClient).mockResolvedValue(client as never)
  try {
    const response = await GET(new Request('https://studio.example/api/auth/google/callback?code=test&state=test-state'))
    expect(response.headers.get('location')).toContain('gcal=connected')
    expect(client.from).not.toHaveBeenCalled()
    expect(client.rpc).toHaveBeenCalledTimes(1)
  } finally {
    vi.unstubAllEnvs()
  }
})
