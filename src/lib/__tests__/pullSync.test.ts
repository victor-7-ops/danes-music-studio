import { beforeEach, expect, it, vi } from 'vitest'
vi.mock('googleapis', () => ({ google: { calendar: vi.fn() } }))
vi.mock('@/lib/gcal/client', () => ({ getGcalClient: vi.fn() }))
vi.mock('@/lib/supabase/serviceClient', () => ({ createServiceClient: vi.fn() }))
import { google } from 'googleapis'
import { getGcalClient } from '@/lib/gcal/client'
import { createServiceClient } from '@/lib/supabase/serviceClient'
import { runPullSync } from '@/lib/gcal/pullSync'
import { makeMockClient } from './supabaseMock'
const event = { id: 'external', start: { dateTime: '2030-01-01T09:00:00+08:00' }, end: { dateTime: '2030-01-01T10:00:00+08:00' } }
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getGcalClient).mockResolvedValue({ oauth2Client: {}, calendarId: 'primary', googleTokensRow: { id: 'tokens', sync_token: 'old' } } as never)
})
function setup(item: object, writeError: object | null = null, conflictError: object | null = null, tokenError: object | null = null) {
  const list = vi.fn().mockResolvedValue({ data: { items: [item], nextSyncToken: 'new' } })
  vi.mocked(google.calendar).mockReturnValue({ events: { list } } as never)
  const db = makeMockClient({ bookings: [{ data: [], error: conflictError }], blocked_slots: [{ data: null, error: writeError }], google_tokens: [{ data: null, error: tokenError }] })
  vi.mocked(createServiceClient).mockReturnValue(db as never)
  return { db, list }
}
it('does not advance the token on a failed blocked-slot write', async () => {
  const { db } = setup(event, { message: 'database unavailable' })
  await expect(runPullSync()).rejects.toEqual({ message: 'database unavailable' })
  expect(db.from.mock.calls.some(([table]) => table === 'google_tokens')).toBe(false)
})
it('normalizes all-day dates to an exclusive Manila interval', async () => {
  const { db } = setup({ id: 'all-day', start: { date: '2030-01-01' }, end: { date: '2030-01-02' } })
  expect((await runPullSync()).inserted).toBe(1)
  const write = db.from.mock.results.find((_, i) => db.from.mock.calls[i][0] === 'blocked_slots')!.value
  expect(write.upsert).toHaveBeenCalledWith(expect.objectContaining({ start_at: '2030-01-01T00:00:00+08:00', end_at: '2030-01-02T00:00:00+08:00' }), expect.anything())
})
it('uses half-open overlap boundaries so touching events do not conflict', async () => {
  const { db } = setup(event)
  await runPullSync()
  const query = db.from.mock.results[0].value
  expect(query.lt).toHaveBeenCalledWith('start_at', event.end.dateTime)
  expect(query.gt).toHaveBeenCalledWith('end_at', event.start.dateTime)
  expect(query.lte).not.toHaveBeenCalled()
  expect(query.gte).not.toHaveBeenCalled()
})
it('does not advance after a failed deletion', async () => {
  const { db } = setup({ id: 'deleted', status: 'cancelled' }, { message: 'delete failed' })
  await expect(runPullSync()).rejects.toEqual({ message: 'delete failed' })
  expect(db.from).toHaveBeenCalledTimes(1)
})
it('does not write blocks or advance after a failed conflict query', async () => {
  const { db } = setup(event, null, { message: 'query failed' })
  await expect(runPullSync()).rejects.toEqual({ message: 'query failed' })
  expect(db.from).toHaveBeenCalledTimes(1)
})
it('reports a failed checkpoint save instead of claiming success', async () => {
  setup(event, null, null, { message: 'token save failed' })
  await expect(runPullSync()).rejects.toEqual({ message: 'token save failed' })
})
it('replays a full sync after expiration without clearing the saved checkpoint first', async () => {
  const { db, list } = setup(event)
  list.mockRejectedValueOnce({ response: { status: 410 } })
  await runPullSync()
  expect(list.mock.calls[1][0].syncToken).toBeUndefined()
  expect(db.from.mock.calls.filter(([table]) => table === 'google_tokens')).toHaveLength(1)
})
