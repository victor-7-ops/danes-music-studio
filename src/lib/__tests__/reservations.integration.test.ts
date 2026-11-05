import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

describe.skipIf(!url || !key)('live reservation transaction', () => {
  it('creates a weekly series atomically and accepts only one concurrent reservation', async () => {
    const db = createClient(url!, key!)
    const name = `TEST ONLY transaction ${randomUUID()}`
    const seriesIds: string[] = []
    const request = { date: '2098-07-01', start: '10:00', end: '11:00', service: 'Rehearsal', payment: 'deposit', name, email: 'test@example.com', phone: '09000000000', band: name, equipment_ids: [], occurrence_count: 2 }
    try {
      const series = await db.rpc('create_customer_reservations', { p_request: request })
      if (series.data?.series_id) seriesIds.push(series.data.series_id)
      expect(series.error).toBeNull()
      expect(series.data.codes).toHaveLength(2)
      const rows = await db.from('bookings').select('id,series_id,start_at').eq('customer_name', name).order('start_at')
      expect(rows.error).toBeNull()
      expect(rows.data).toHaveLength(2)
      expect(new Date(rows.data![1].start_at).getTime() - new Date(rows.data![0].start_at).getTime()).toBe(7 * 86400000)
      expect(rows.data![0].series_id).toBe(rows.data![1].series_id)

      // The first occurrence is free, but the second conflicts with the series.
      const conflict = await db.rpc('create_customer_reservations', { p_request: { ...request, date: '2098-06-24' } })
      expect(conflict.error).not.toBeNull()
      const afterConflict = await db.from('bookings').select('id').eq('customer_name', name)
      expect(afterConflict.data).toHaveLength(2)

      const results = await Promise.all([1, 2].map(() => db.rpc('create_customer_reservations', { p_request: { ...request, date: '2098-08-01', occurrence_count: 1 } })))
      expect(results.filter(result => !result.error)).toHaveLength(1)
      expect(results.filter(result => result.error)).toHaveLength(1)
    } finally {
      const removed = await db.from('bookings').delete().eq('customer_name', name)
      expect(removed.error).toBeNull()
      if (seriesIds.length) {
        const seriesRemoved = await db.from('booking_series').delete().in('id', seriesIds)
        expect(seriesRemoved.error).toBeNull()
      }
    }
  }, 30000)
})
