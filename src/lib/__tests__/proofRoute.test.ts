// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/serviceClient', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/telegram', () => ({ sendTelegramMessage: vi.fn(), paymentProofUploadedMessage: vi.fn(() => 'proof') }))

import { createServiceClient } from '@/lib/supabase/serviceClient'
import { POST } from '@/app/api/bookings/proof/route'

const upload = vi.fn(async () => ({ error: null }))
const remove = vi.fn(async () => ({ error: null }))
let acceptedToken = 'capability-1'
let updateSucceeds = true
const booking = {
  id: 'booking-1', status: 'pending', hold_expires_at: '2099-01-01T00:00:00Z', payment_proof_url: null,
  confirmation_code: 'DMS-0123456789ABCDEF', customer_name: 'Jane', band_name: null,
  payment_method: 'deposit', deposit_amount: 100, amount_paid: 0, total_amount: 200,
  service_types: { name: 'Rehearsal' },
}
const client = {
  from: vi.fn(() => {
    const filters: Array<[string, unknown]> = []
    const builder: Record<string, unknown> = {}
    builder.select = vi.fn(() => builder)
    builder.eq = vi.fn((key: string, value: unknown) => { filters.push([key, value]); return builder })
    builder.update = vi.fn(() => builder)
    builder.is = vi.fn(() => builder)
    builder.or = vi.fn(() => builder)
    builder.single = vi.fn(async () => ({ data: filters.some(([key, value]) => key === 'cancel_token' && value === acceptedToken) ? booking : null, error: null }))
    builder.maybeSingle = vi.fn(async () => ({ data: updateSucceeds ? { id: booking.id } : null, error: null }))
    return builder
  }),
  storage: { from: vi.fn(() => ({ upload, remove })) },
}

function request(token: string | undefined, ip: string) {
  const form = new FormData()
  form.set('ref', booking.confirmation_code)
  if (token) form.set('token', token)
  form.set('file', new File([new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4])], 'proof.png', { type: 'image/png' }))
  return new NextRequest('http://localhost/api/bookings/proof', { method: 'POST', headers: { 'x-forwarded-for': ip }, body: form })
}

describe('payment proof capability route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    acceptedToken = 'capability-1'
    updateSucceeds = true
    vi.mocked(createServiceClient).mockReturnValue(client as never)
  })

  it('requires the high-entropy token before touching storage or the privileged client', async () => {
    const response = await POST(request(undefined, '198.51.100.1'))
    expect(response.status).toBe(400)
    expect(createServiceClient).not.toHaveBeenCalled()
    expect(upload).not.toHaveBeenCalled()
  })

  it('rejects a mismatched code/token capability pair before upload', async () => {
    acceptedToken = 'different-token'
    const response = await POST(request('capability-1', '198.51.100.2'))
    expect(response.status).toBe(404)
    expect(upload).not.toHaveBeenCalled()
  })

  it('cleans up an uploaded object if the conditional booking update loses the race', async () => {
    updateSucceeds = false
    const response = await POST(request('capability-1', '198.51.100.3'))
    expect(response.status).toBe(409)
    expect(upload).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledTimes(1)
  })
})
