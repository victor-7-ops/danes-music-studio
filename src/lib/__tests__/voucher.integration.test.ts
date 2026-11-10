// Integration test — requires live Supabase connection.
// Reads NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
// from .env.local. Run: npm run test:integration
//
// Covers the voucher feature's concurrency/quota/RLS guarantees that unit
// tests (mocked .rpc()) can't exercise: a real Postgres row lock serializing
// concurrent redemptions, the whole-series quota pre-check rejecting a
// series atomically, and RLS actually denying anon access to voucher tables.
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { afterEach, describe, expect, it } from 'vitest'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

const skipIntegration = !url || !serviceKey

const voucherIds: string[] = []
const customerNames: string[] = []

describe.skipIf(skipIntegration)('voucher feature — live concurrency, quota, and RLS', () => {
  const db = skipIntegration ? null! : createClient(url!, serviceKey!)

  async function cleanup() {
    // voucher_redemptions.booking_id and .voucher_id have no ON DELETE
    // CASCADE (NO ACTION) — redemption rows must go first, or deleting the
    // booking/voucher silently fails on the FK and leaves both behind.
    if (voucherIds.length) {
      await db.from('voucher_redemptions').delete().in('voucher_id', voucherIds)
    }
    if (customerNames.length) {
      const { error } = await db.from('bookings').delete().in('customer_name', customerNames)
      if (error) console.error('[voucher.integration.test cleanup] bookings delete failed', error)
    }
    if (voucherIds.length) {
      const { error } = await db.from('vouchers').delete().in('id', voucherIds)
      if (error) console.error('[voucher.integration.test cleanup] vouchers delete failed', error)
    }
    voucherIds.length = 0
    customerNames.length = 0
  }

  afterEach(cleanup)

  it('serializes concurrent redemptions: exactly one of two simultaneous bookings wins a max_redemptions=1 voucher', async () => {
    const code = `TESTRACE${randomUUID().slice(0, 8).toUpperCase()}`
    const { data: voucher, error: voucherError } = await db
      .from('vouchers')
      .insert({ code, percent: 50, enabled: true, max_redemptions: 1 })
      .select('id')
      .single()
    expect(voucherError).toBeNull()
    voucherIds.push(voucher!.id)

    const nameA = `TEST ONLY voucher race A ${randomUUID()}`
    const nameB = `TEST ONLY voucher race B ${randomUUID()}`
    customerNames.push(nameA, nameB)

    const baseRequest = {
      date: '2098-09-01', start: '10:00', end: '11:00', service: 'Rehearsal', payment: 'deposit',
      email: 'test@example.com', phone: '09000000000', equipment_ids: [], occurrence_count: 1,
      voucher_code: code,
    }

    const results = await Promise.all([
      db.rpc('create_customer_reservations', { p_request: { ...baseRequest, name: nameA, band: nameA, date: '2098-09-01' } }),
      db.rpc('create_customer_reservations', { p_request: { ...baseRequest, name: nameB, band: nameB, date: '2098-09-02' } }),
    ])

    const succeeded = results.filter((r) => !r.error)
    const failed = results.filter((r) => r.error)
    expect(succeeded).toHaveLength(1)
    expect(failed).toHaveLength(1)
    expect(failed[0].error?.message).toContain('voucher_exhausted')

    const { data: finalVoucher } = await db.from('vouchers').select('redemptions_used').eq('id', voucher!.id).single()
    expect(finalVoucher?.redemptions_used).toBe(1)

    const { data: redemptions } = await db.from('voucher_redemptions').select('state').eq('voucher_id', voucher!.id)
    expect(redemptions).toHaveLength(1)
  }, 30000)

  it('rejects a whole recurring series atomically when the voucher lacks quota for every occurrence', async () => {
    const code = `TESTQUOTA${randomUUID().slice(0, 8).toUpperCase()}`
    const { data: voucher, error: voucherError } = await db
      .from('vouchers')
      .insert({ code, percent: 20, enabled: true, max_redemptions: 1 })
      .select('id')
      .single()
    expect(voucherError).toBeNull()
    voucherIds.push(voucher!.id)

    const name = `TEST ONLY voucher quota shortfall ${randomUUID()}`
    customerNames.push(name)

    // occurrence_count: 2 against max_redemptions: 1 — the whole series must
    // be rejected before any occurrence is inserted, not just the second one.
    const result = await db.rpc('create_customer_reservations', {
      p_request: {
        date: '2098-09-10', start: '10:00', end: '11:00', service: 'Rehearsal', payment: 'deposit',
        name, email: 'test@example.com', phone: '09000000000', band: name, equipment_ids: [],
        occurrence_count: 2, voucher_code: code,
      },
    })

    expect(result.error).not.toBeNull()
    expect(result.error?.message).toContain('voucher_exhausted')

    const { data: rows } = await db.from('bookings').select('id').eq('customer_name', name)
    expect(rows).toHaveLength(0)

    const { data: finalVoucher } = await db.from('vouchers').select('redemptions_used').eq('id', voucher!.id).single()
    expect(finalVoucher?.redemptions_used).toBe(0)
  }, 30000)

  it.skipIf(!anonKey)('denies anonymous read/write access to vouchers and voucher_redemptions (RLS)', async () => {
    const anon = createClient(url!, anonKey!)

    // RLS with no anon policy either errors the query outright or silently
    // returns zero rows, depending on the Postgres/PostgREST version — both
    // mean "no access", so accept either shape rather than one exact value.
    const read = await anon.from('vouchers').select('id, code').limit(1)
    expect(read.error !== null || (read.data ?? []).length === 0).toBe(true)

    const write = await anon.from('vouchers').insert({ code: `ANON${randomUUID().slice(0, 6)}`, percent: 10, enabled: true })
    expect(write.error).not.toBeNull()

    const readRedemptions = await anon.from('voucher_redemptions').select('id').limit(1)
    expect(readRedemptions.error !== null || (readRedemptions.data ?? []).length === 0).toBe(true)
  })
})

if (skipIntegration) {
  describe('voucher feature — live concurrency, quota, and RLS (SKIPPED)', () => {
    it('skipped — SUPABASE_SERVICE_ROLE_KEY not set in .env.local', () => {
      console.warn(
        '\n[voucher.integration.test.ts] Integration test skipped.\n' +
        'Add SUPABASE_SERVICE_ROLE_KEY to .env.local and run: npm run test:integration\n'
      )
      expect(true).toBe(true)
    })
  })
}
