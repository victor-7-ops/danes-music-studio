// Integration test — requires live Supabase connection.
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local
// Run: pnpm test:integration

import { describe, it, expect, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

// If the service role key is missing, skip the entire suite with a clear message.
// The service role key bypasses RLS so we can insert test rows directly.
const skipIntegration = !SUPABASE_URL || !SERVICE_ROLE_KEY

// Far-future date to avoid colliding with any real bookings data
const TEST_DATE = '2099-01-01'
// 10AM Manila = 2099-01-01T02:00:00Z, 11AM Manila = 2099-01-01T03:00:00Z
const SLOT_START = `${TEST_DATE}T02:00:00Z`
const SLOT_END   = `${TEST_DATE}T03:00:00Z`

const insertedIds: string[] = []

describe.skipIf(skipIntegration)('EXCLUDE constraint — bookings_no_overlap', () => {
  const supabase = skipIntegration
    ? null
    : createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!)

  afterAll(async () => {
    if (!supabase || insertedIds.length === 0) return
    // Cleanup: cancel all rows inserted by this test run
    await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .in('id', insertedIds)
  })

  it('rejects a second overlapping pending booking with exclusion constraint error', async () => {
    // Fetch a valid service_type_id (Rehearsal)
    const { data: serviceTypes, error: stErr } = await supabase!
      .from('service_types')
      .select('id')
      .eq('name', 'Rehearsal')
      .limit(1)
      .single()

    expect(stErr).toBeNull()
    expect(serviceTypes).not.toBeNull()

    const serviceTypeId = serviceTypes!.id
    const baseCode = `TEST-${Date.now()}-${Math.floor(Math.random() * 10000)}`

    // Insert first (base) booking — should succeed
    const { data: first, error: firstErr } = await supabase!
      .from('bookings')
      .insert({
        service_type_id: serviceTypeId,
        start_at: SLOT_START,
        end_at: SLOT_END,
        customer_name: 'Test User A',
        customer_phone: '+63 900 000 0001',
        customer_email: 'test-a@example.com',
        total_amount: 350.00,
        deposit_amount: 175.00,
        confirmation_code: `${baseCode}-A`,
        status: 'pending',
        source: 'online',
        payment_method: 'none',
      })
      .select('id')
      .single()

    expect(firstErr).toBeNull()
    expect(first).not.toBeNull()
    if (first?.id) insertedIds.push(first.id)

    // Attempt second overlapping booking — must be rejected by EXCLUDE constraint
    const { data: second, error: secondErr } = await supabase!
      .from('bookings')
      .insert({
        service_type_id: serviceTypeId,
        start_at: SLOT_START,
        end_at: SLOT_END,
        customer_name: 'Test User B',
        customer_phone: '+63 900 000 0002',
        customer_email: 'test-b@example.com',
        total_amount: 350.00,
        deposit_amount: 175.00,
        confirmation_code: `${baseCode}-B`,
        status: 'pending',
        source: 'online',
        payment_method: 'none',
      })
      .select('id')
      .single()

    // The second insert must fail with the exclusion constraint error
    expect(secondErr).not.toBeNull()
    expect(second).toBeNull()

    const errorMessage = secondErr!.message.toLowerCase()
    const isExclusionError =
      errorMessage.includes('bookings_no_overlap') ||
      errorMessage.includes('exclusion constraint') ||
      errorMessage.includes('conflicting key value violates exclusion constraint')

    expect(isExclusionError).toBe(true)
  })
})

// When service role key is missing, emit a clear notice (not a failure)
if (skipIntegration) {
  describe('EXCLUDE constraint — bookings_no_overlap (SKIPPED)', () => {
    it('skipped — SUPABASE_SERVICE_ROLE_KEY not set in .env.local', () => {
      console.warn(
        '\n[bookings.test.ts] Integration test skipped.\n' +
        'Add SUPABASE_SERVICE_ROLE_KEY to .env.local and run: pnpm test:integration\n'
      )
      expect(true).toBe(true)
    })
  })
}
