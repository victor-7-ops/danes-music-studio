import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
vi.mock('@/lib/supabase/serviceClient', () => ({ createServiceClient: vi.fn() }))
vi.mock('@/lib/gcal/pushSync', () => ({ deleteGcalEvent: vi.fn() }))
vi.mock('@/lib/emails/cancel', () => ({ sendCancelEmail: vi.fn() }))
import { createServiceClient } from '@/lib/supabase/serviceClient'
import { deleteGcalEvent } from '@/lib/gcal/pushSync'
import { sendCancelEmail } from '@/lib/emails/cancel'
import * as cancel from '@/app/api/booking/cancel/route'
import * as reschedule from '@/app/api/booking/reschedule/route'
import { makeMockClient } from './supabaseMock'

describe.each([['cancel', cancel], ['reschedule', reschedule]] as const)('%s booking', (name, route) => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(sendCancelEmail).mockResolvedValue(undefined)
  })
  it('does not mutate bookings when an email scanner opens GET', async () => {
    const db = makeMockClient({ bookings: [{ data: { confirmation_code: 'TEST' }, error: null }] })
    vi.mocked(createServiceClient).mockReturnValue(db as never)
    await route.GET(new NextRequest(`https://studio.example/api/booking/${name}?token=test`))
    expect(db.from.mock.results[0].value.update).not.toHaveBeenCalled()
  })
  it('reports a lost update race and leaves Calendar untouched', async () => {
    const db = makeMockClient({ bookings: [
      { data: { id: 'id', confirmation_code: 'TEST', status: 'confirmed', start_at: '2099-01-01', gcal_event_id: 'event' }, error: null },
      { data: null, error: { message: 'database unavailable' } },
    ] })
    vi.mocked(createServiceClient).mockReturnValue(db as never)
    const body = new FormData()
    body.set('token', 'test')
    const response = await route.POST(new NextRequest(`https://studio.example/api/booking/${name}`, { method: 'POST', body }))
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toContain('error=already_cancelled')
    expect(deleteGcalEvent).not.toHaveBeenCalled()
  })
  it('redirects POST to a GET page only after Calendar removal finishes', async () => {
    const db = makeMockClient({ bookings: [
      { data: { id: 'id', confirmation_code: 'TEST', status: 'confirmed', start_at: '2099-01-01', gcal_event_id: 'event' }, error: null },
      { data: { id: 'id' }, error: null },
    ] })
    vi.mocked(createServiceClient).mockReturnValue(db as never)
    let removed = false
    vi.mocked(deleteGcalEvent).mockImplementation(async () => { await Promise.resolve(); removed = true; return true })
    const body = new FormData()
    body.set('token', 'test')
    const response = await route.POST(new NextRequest(`https://studio.example/api/booking/${name}`, { method: 'POST', body }))
    expect(response.status).toBe(303)
    expect(removed).toBe(true)
    expect(response.headers.get('location')).toContain(name === 'cancel' ? 'cancelled=1' : 'rescheduled_from=TEST')
  })
})
