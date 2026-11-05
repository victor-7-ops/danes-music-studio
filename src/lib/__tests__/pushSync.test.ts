import { beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('googleapis', () => ({ google: { calendar: vi.fn() } }))
vi.mock('@/lib/gcal/client', () => ({ getGcalClient: vi.fn() }))
vi.mock('@/lib/supabase/serviceClient', () => ({ createServiceClient: vi.fn() }))
import { google } from 'googleapis'
import { getGcalClient } from '@/lib/gcal/client'
import { createServiceClient } from '@/lib/supabase/serviceClient'
import { pushGcalEvent, deleteGcalEvent } from '@/lib/gcal/pushSync'
import { makeMockClient } from './supabaseMock'

describe('Calendar retries', () => {
  const events = { insert: vi.fn(), patch: vi.fn(), delete: vi.fn() }
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(getGcalClient).mockResolvedValue({ oauth2Client: {}, calendarId: 'primary' } as never)
    vi.mocked(google.calendar).mockReturnValue({ events } as never)
  })
  function database(saveError: unknown = null) {
    const db = makeMockClient({ bookings: [
      { data: { id: 'abc-123', start_at: '2026-11-06T01:00:00Z', end_at: '2026-11-06T02:00:00Z', total_amount: 35000, amount_paid: 35000 }, error: null },
      { data: null, error: saveError },
    ] })
    vi.mocked(createServiceClient).mockReturnValue(db as never)
    return db
  }
  it('reuses the booking ID when a previous insert already succeeded', async () => {
    const db = database()
    events.insert.mockRejectedValue({ response: { status: 409 } })
    expect(await pushGcalEvent('abc-123')).toBe(true)
    expect(events.insert.mock.calls[0][0].requestBody.id).toBe('abc123')
    expect(events.patch.mock.calls[0][0].eventId).toBe('abc123')
    expect(db.from.mock.results[1].value.update).toHaveBeenCalledWith({ gcal_event_id: 'abc123' })
  })
  it('surfaces failure to save the event ID', async () => {
    database(new Error('database unavailable'))
    await expect(pushGcalEvent('abc-123')).rejects.toThrow('database unavailable')
  })
  it.each([404, 410])('treats an already removed event (%s) as success', async (status) => {
    events.delete.mockRejectedValue({ response: { status } })
    expect(await deleteGcalEvent('event')).toBe(true)
  })
  it('does not hide authentication failures', async () => {
    events.delete.mockRejectedValue({ response: { status: 401 } })
    await expect(deleteGcalEvent('event')).rejects.toEqual({ response: { status: 401 } })
  })
})
