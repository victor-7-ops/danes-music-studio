// Integration test — requires live Supabase connection.
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
// Run: pnpm test:integration
//
// QA finding (2026-07-21, verified against a live DB): the original version
// of this test tried to insert two `bookings` rows with the same overlapping
// start_at/end_at directly (bypassing createBooking.ts's app-level pre-check,
// but not the DB), then fire two reserve_equipment() RPC calls to prove the
// advisory-lock serialization in 20260022000000_equipment_atomic_reserve.sql
// prevents a double-reservation. That precondition is structurally
// impossible: `bookings_no_overlap` (20260015000000) is a table-wide
// exclusion constraint with no room/resource partition — since this is a
// single-room studio, it already guarantees no two non-cancelled bookings
// can ever have overlapping [start_at, end_at) ranges, full stop. The
// second concurrent insert in makeBooking() below always fails with a
// 23P01 exclusion violation before either reserve_equipment() call can run,
// so the RPC-level race this test was written to exercise can never
// actually occur for two DIFFERENT bookings in this schema.
//
// This does not mean plans/016-equipment-double-booking-race.md's fix is
// wrong or should be reverted — reserve_equipment()'s advisory lock is
// still correct, harmless, and would matter if this app ever became
// multi-room (each room would need its own overlap scope, and equipment
// could then legitimately be requested by two rooms at once). For the
// current single-room reality, it's a defense-in-depth layer whose primary
// scenario is already unreachable thanks to bookings_no_overlap. This test
// now verifies the layer that ACTUALLY prevents the double-booking risk:
// the room-level exclusion constraint itself.

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

  it('room-level exclusion constraint prevents two overlapping bookings from ever coexisting (the real backstop for equipment double-booking)', async () => {
    const { data: serviceTypes, error: stErr } = await supabase!
      .from('service_types')
      .select('id')
      .eq('name', 'Rehearsal')
      .limit(1)
      .single()
    expect(stErr).toBeNull()
    const serviceTypeId = serviceTypes!.id

    const baseCode = `TEST-EQ-${Date.now()}`

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
      if (data) insertedBookingIds.push(data.id)
      return { data, error }
    }

    // First booking for the slot succeeds normally.
    const first = await makeBooking('A')
    expect(first.error).toBeNull()

    // A second booking for the identical overlapping window must be
    // rejected by bookings_no_overlap (Postgres exclusion_violation, code
    // 23P01) — this fires regardless of equipment, before any
    // reserve_equipment() call could ever run. This is what makes the
    // equipment-quantity race structurally unreachable in this schema.
    const second = await makeBooking('B')
    expect(second.data).toBeNull()
    expect(second.error).not.toBeNull()
    expect(second.error?.code).toBe('23P01')
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
