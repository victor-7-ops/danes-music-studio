/**
 * Pure helpers for the "book again" lookup route
 * (src/app/api/booking/lookup-previous/route.ts). Extracted so the
 * matching/shaping/rate-limit logic is unit-testable without a live DB —
 * follows this repo's pattern of pulling pure logic out of route handlers
 * (see src/lib/slotSelection.ts).
 *
 * Normalization note: email/phone are only `.trim()`-ed, never
 * `.toLowerCase()`-d. This must match how customer_email/customer_phone are
 * stored (src/lib/actions/createBooking.ts, src/lib/actions/admin/createOnsite.ts
 * both only `.trim()`) — there's no case-insensitive collation on those
 * columns, so lowercasing here would make legitimate returning customers with
 * mixed-case stored emails silently fail to match.
 */

export interface LookupInput {
  email: string
  phone: string
}

/**
 * Validates + normalizes raw request body fields. Returns null for anything
 * malformed (non-string, missing, or empty after trim) — the route treats
 * null identically to a DB no-match, so no signal distinguishes "bad input"
 * from "no match" from "wrong pair".
 */
export function normalizeLookupInput(rawEmail: unknown, rawPhone: unknown): LookupInput | null {
  const email = typeof rawEmail === 'string' ? rawEmail.trim() : ''
  const phone = typeof rawPhone === 'string' ? rawPhone.trim() : ''
  if (!email || !phone) return null
  return { email, phone }
}

export interface LookupResult {
  bandName: string | null
  equipmentIds: string[]
}

export const EMPTY_LOOKUP_RESULT: LookupResult = { bandName: null, equipmentIds: [] }

export interface RawBookingMatch {
  band_name: string | null
  booking_equipment: { equipment_id: string }[] | null
}

/** Shapes a raw Supabase row (or null) into the uniform response the client expects. */
export function toLookupResult(data: RawBookingMatch | null | undefined): LookupResult {
  if (!data) return EMPTY_LOOKUP_RESULT
  return {
    bandName: data.band_name,
    equipmentIds: (data.booking_equipment ?? []).map((be) => be.equipment_id),
  }
}

// --- Rate limiter -----------------------------------------------------
//
// In-memory, per-serverless-instance, best-effort only. Does NOT hold state
// across Vercel's multiple function instances or cold starts — a determined
// attacker spreading requests across instances isn't stopped by this. It's a
// deterrent against casual guessing, matching the risk level accepted in
// plans/012b-quick-rebook-v2.md ("Residual risk"), not a hard guarantee.
// Revisit with a distributed limiter (e.g. Upstash Redis) if traffic grows
// enough for this to stop being effective — see that plan's Maintenance notes.

export interface RateLimiterOptions {
  limit: number
  windowMs: number
}

export class InMemoryRateLimiter {
  private hits = new Map<string, number[]>()

  constructor(private options: RateLimiterOptions) {}

  /** Returns true if the request is allowed, false if the key is currently rate-limited. */
  check(key: string, now: number = Date.now()): boolean {
    const windowStart = now - this.options.windowMs
    const timestamps = (this.hits.get(key) ?? []).filter((t) => t > windowStart)

    if (timestamps.length >= this.options.limit) {
      this.hits.set(key, timestamps)
      return false
    }

    timestamps.push(now)
    this.hits.set(key, timestamps)
    return true
  }
}
