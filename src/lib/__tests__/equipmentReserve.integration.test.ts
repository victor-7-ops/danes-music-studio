// Integration test — requires live Supabase connection.
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
// Run: pnpm test:integration
//
// Fires two concurrent reserve_equipment() RPC calls (see
// supabase/migrations/20260022000000_equipment_atomic_reserve.sql) against
// the same single-quantity equipment item and the same overlapping time
// window, and asserts exactly one succeeds — this is the race condition
// plans/016-equipment-double-booking-race.md fixes.

import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const skipIntegration = !SUPABASE_URL || !SERVICE_ROLE_KEY

// Far-future date/time to avoid colliding with real bookings data or the
// bookings.test.ts EXCLUDE-constraint suite's slot.
const TEST_DATE = '2099-06-01'
const SLOT_START = `${TEST_DATE}T02:00:00Z`
const SLOT_END = `${TEST_DATE}T03:00:00Z`

const insertedBookingIds: string[] = []
const insertedEquipmentIds: string[] = []

describe.skipIf(skipIntegration)('reserve_equipment RPC — concurrency', () => {
  const supabase = skipIntegration
    ? null
    : createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!)

  afterAll(async () => {
    if (!supabase) return
    if (insertedBookingIds.length > 0) {
      // booking_equipment rows cascade-delete with the booking.
      await supabase.from('bookings').delete().in('id', insertedBookingIds)
    }
    if (insertedEquipmentIds.length > 0) {
      await supabase.from('equipment').delete().in('id', insertedEquipmentIds)
    }
  })

  it('exactly one of two concurrent requests for the last unit succeeds', async () => {
    const { data: serviceTypes, error: stErr } = await supabase!
      .from('service_types')
      .select('id')
      .eq('name', 'Rehearsal')
      .limit(1)
      .single()
    expect(stErr).toBeNull()
    const serviceTypeId = serviceTypes!.id

    // Single-unit equipment item dedicated to this test run.
    const { data: equipment, error: eqErr } = await supabase!
      .from('equipment')
      .insert({
        name: `Test Amp ${Date.now()}`,
        price_per_session: 10000,
        active: true,
        quantity: 1,
      })
      .select('id')
      .single()
    expect(eqErr).toBeNull()
    insertedEquipmentIds.push(equipment!.id)

    const baseCode = `TEST-EQ-${Date.now()}`

    // Create two pending bookings for the same overlapping time window —
    // mirrors createBooking.ts step 7 (booking must exist before the RPC
    // call, since booking_equipment.booking_id is a real FK).
    async function makeBooking(suffix: string) {
      const { data, error } = await supabase!
        .from('bookings')
        .insert({
          service_type_id: serviceTypeId,
          start_at: SLOT_START,
          end_at: SLOT_END,
          customer_name: `Concurrency Test ${suffix}`,
          customer_phone: '+63 900 000 0000',
          customer_email: `test-eq-${suffix}@example.com`,
          total_amount: 10000,
          deposit_amount: 5000,
          confirmation_code: `${baseCode}-${suffix}`,
          status: 'pending',
          source: 'online',
          payment_method: 'none',
        })
        .select('id')
        .single()
      expect(error).toBeNull()
      insertedBookingIds.push(data!.id)
      return data!.id as string
    }

    const [bookingIdA, bookingIdB] = await Promise.all([
      makeBooking('A'),
      makeBooking('B'),
    ])

    // Fire both reservation RPCs concurrently for the same equipment_id and
    // overlapping window. The advisory-lock serialization inside
    // reserve_equipment() must ensure only one sees the unit as free.
    const [resultA, resultB] = await Promise.all([
      supabase!.rpc('reserve_equipment', {
        p_booking_id: bookingIdA,
        p_start_at: SLOT_START,
        p_end_at: SLOT_END,
        p_items: [{ equipment_id: equipment!.id, price_at_booking: 10000 }],
      }),
      supabase!.rpc('reserve_equipment', {
        p_booking_id: bookingIdB,
        p_start_at: SLOT_START,
        p_end_at: SLOT_END,
        p_items: [{ equipment_id: equipment!.id, price_at_booking: 10000 }],
      }),
    ])

    expect(resultA.error).toBeNull()
    expect(resultB.error).toBeNull()

    const aUnavailable = (resultA.data ?? []).length > 0
    const bUnavailable = (resultB.data ?? []).length > 0

    // Exactly one of the two must be marked unavailable — never both
    // succeeding (the bug this fixes) and never both failing.
    expect(aUnavailable).not.toEqual(bUnavailable)

    // Cross-check against booking_equipment: exactly one row should exist
    // for this equipment_id in this window.
    const { data: reservedRows, error: reservedErr } = await supabase!
      .from('booking_equipment')
      .select('booking_id')
      .eq('equipment_id', equipment!.id)
    expect(reservedErr).toBeNull()
    expect(reservedRows).toHaveLength(1)
  })
})

if (skipIntegration) {
  describe('reserve_equipment RPC — concurrency (SKIPPED)', () => {
    it('skipped — SUPABASE_SERVICE_ROLE_KEY not set in .env.local', () => {
      console.warn(
        '\n[equipmentReserve.integration.test.ts] Integration test skipped.\n' +
        'Add SUPABASE_SERVICE_ROLE_KEY to .env.local and run: pnpm test:integration\n'
      )
      expect(true).toBe(true)
    })
  })
}
