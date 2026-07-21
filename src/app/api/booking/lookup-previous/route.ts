export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/serviceClient'
import {
  EMPTY_LOOKUP_RESULT,
  InMemoryRateLimiter,
  normalizeLookupInput,
  toLookupResult,
} from '@/lib/lookupPreviousBooking'

// See src/lib/lookupPreviousBooking.ts for rate-limiter caveats (in-memory,
// per-instance, best-effort only) — suggested N=5 requests per 60s window
// per plans/012b-quick-rebook-v2.md Step 3.
const rateLimiter = new InMemoryRateLimiter({ limit: 5, windowMs: 60_000 })

export async function POST(req: NextRequest) {
  // Best-effort client key — falls back to a shared bucket if neither header
  // is present (e.g. local dev), which just makes the limiter stricter, never
  // less strict.
  const key =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'

  if (!rateLimiter.check(key)) {
    // Rate limited: identical shape to a no-match response, just a 429
    // status. The client (DetailsForm.tsx) treats this as "skip the
    // suggestion silently" — this is a convenience feature, not a blocker.
    return NextResponse.json(EMPTY_LOOKUP_RESULT, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const input = normalizeLookupInput(body?.email, body?.phone)

  if (!input) {
    return NextResponse.json(EMPTY_LOOKUP_RESULT)
  }

  const supabase = createServiceClient()
  // AND matching (not .or(...)) — an attacker needs both fields right for
  // the same booking. See plans/012b-quick-rebook-v2.md "What's different
  // this time" for why this replaces the two rejected prior designs.
  const { data } = await supabase
    .from('bookings')
    .select('band_name, booking_equipment(equipment_id)')
    .eq('customer_email', input.email)
    .eq('customer_phone', input.phone)
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json(toLookupResult(data))
}
