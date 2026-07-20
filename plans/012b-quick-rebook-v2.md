# Plan 012b: Add a "book again" suggestion via a rate-limited, dual-match service-role lookup

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat b4c8b4e..HEAD -- src/components/booking/DetailsForm.tsx src/lib/actions/createBooking.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3 (direction)
- **Effort**: M
- **Risk**: LOW-MED — see "Residual risk" below; explicitly accepted by the studio owner given the business's small scale, not eliminated
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `b4c8b4e`, 2026-07-13
- **Supersedes**: plans/012-quick-rebook-suggestion.md (REJECTED — anon-client design exposed PII to unauthenticated enumeration) and a second rejected attempt using a service-role route with `email OR phone` matching (same enumeration problem, just moved past RLS instead of fixed)

## Why this matters

There's no customer account or booking history — every booking is looked up by a one-off confirmation code. For a rehearsal studio depending on repeat bands, returning customers get zero convenience from having booked before. This adds the lightweight alternative: match on phone AND email together at the details step, offer to prefill the previous booking's band name/gear selection — without building full accounts/auth, and without the OTP/email-verification flow that would otherwise be needed to fully close the enumeration gap (explicitly skipped per owner's call: this is a small, single-room studio with a small customer base, and the residual risk below was judged acceptable at this scale).

## Why the two prior attempts were rejected

1. **First attempt** (`plans/012-quick-rebook-suggestion.md`): used a server action with `createClient()` (anon Supabase key). The only relevant RLS policy (`anon_read_booking_slots`, `supabase/migrations/20260005000000_2_rls_public_read.sql`) is row-scoped, not column-scoped — so anon queries return *every column* of matching rows, including `customer_email`, `customer_phone`, `confirmation_code`. Any anon-role query filtered by guessed email/phone would leak full booking rows, not just the intended `band_name`+equipment fields. Rejected before implementation.
2. **Second attempt**: moved to a service-role route (`createServiceClient()`) to bypass RLS, but still matched on `email OR phone` — meaning a guess of just an email (no matching phone) was enough to pull a real customer's booking history. This narrowed *what* leaked (only `band_name`+equipment, not the full row) but didn't fix *that* it leaked to an unauthenticated guesser. Blocked by the permission classifier before implementation, correctly.

## What's different this time

- **Match on `email AND phone` together, not `OR`.** An attacker now needs to correctly guess BOTH a specific customer's email and their phone number for the exact same booking to get anything back — a much higher bar than guessing one field. This is the primary mitigation.
- **Rate limiting** on the endpoint (see Step 3) — caps how many lookup attempts a single client can make in a time window, closing off brute-force enumeration even of the AND-matched pair.
- **Uniform non-response**: no-match, partial-match (email right/phone wrong or vice versa), and malformed input all return the identical `{ bandName: null, equipmentIds: [] }` shape with the same HTTP status — no timing or content signal distinguishes "close guess" from "no idea."

## Residual risk (accepted, not eliminated)

A customer's own returning visit is the intended path: they type the same email+phone they always use, get their own history back. An attacker who has *already* obtained both a specific customer's email AND phone number (e.g. from a data breach elsewhere, or by knowing them personally) could still retrieve their `band_name` and equipment preferences — low-sensitivity data, not payment info, not the confirmation code, not other bookings' details. Given the studio's small scale (single room, small local customer base, low attack-worthiness of "someone's rehearsal gear preferences"), this residual risk was explicitly accepted by the studio owner rather than building a full OTP/email-verification flow. If the business scales significantly (multi-location, larger customer base), revisit with proper verification.

## Current state

- `src/components/booking/DetailsForm.tsx` — where customers enter `customer_name`, `customer_email`, `customer_phone`, `band_name`, equipment selection. Read in full before starting (not yet read in this planning pass) — confirm exact field names/state shape.
- `src/lib/actions/createBooking.ts` — read in full to confirm exact field names/shapes used for email, phone, band_name, equipment selection, so the new route's response shape lines up with what the form actually needs to prefill.
- `src/lib/supabase/serviceClient.ts` — the service-role Supabase client factory already used by `src/app/api/booking/cancel/route.ts` and `src/app/api/booking/reschedule/route.ts`. Use this exact same factory — it's the established pattern in this codebase for public-facing-but-privileged lookups.
- `src/app/api/booking/cancel/route.ts` — read as the precedent for a public API route using the service-role client responsibly: selects only specific columns, never dumps a full row.
- No rate-limiting infrastructure currently exists anywhere in this codebase (confirmed: no `upstash`, `rate-limit`, or similar dependency in `package.json`). This plan needs the simplest possible rate limit that doesn't require adding new infrastructure — see Step 3's approach (in-memory, per-instance, best-effort) with an explicit note on its limits.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Tests | `pnpm test:run` | all pass |
| Lint | `pnpm lint` | exit 0 — if it fails with "ESLint couldn't determine the plugin @next/next uniquely", that's a known pre-existing worktree/node_modules-nesting sandbox artifact unrelated to code changes (confirmed independently by multiple prior executors and by the reviewer running lint clean in the actual main repo tree). Note it, don't block on it. |

## Scope

**In scope**:
- New API route: `src/app/api/booking/lookup-previous/route.ts` — `POST` handler (not `GET` — contact info as input shouldn't ride in a URL/query string or leak into logs/browser history).
- Simple in-memory rate limiter (Step 3) scoped to this one route.
- `src/components/booking/DetailsForm.tsx` — wire in the lookup + prefill suggestion UI.
- Optional small extraction: a pure matching-logic helper (e.g. `src/lib/lookupPreviousBooking.ts`) if it makes the route testable without a live DB — follow this repo's pattern of extracting pure/testable logic out of route handlers where feasible (see `src/lib/slotSelection.ts` as precedent).

**Out of scope**:
- Any customer account/auth system.
- Any schema or RLS policy change.
- OTP / email verification flow — explicitly deferred per the owner's risk acceptance above.
- Admin-side booking views.
- A full "my bookings" history page.
- Production-grade distributed rate limiting (Redis/Upstash) — the in-memory approach is a best-effort deterrent, not a hard guarantee, and that's an accepted tradeoff for this feature's risk level (see Step 3).

## Git workflow

- Branch: `advisor/012b-quick-rebook-v2`
- Commit per logical step; message style matches `git log` (lowercase, imperative: e.g. `feat: add book-again suggestion via rate-limited dual-match lookup`)
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Read all files listed in "Current state" fully

### Step 2: Write the API route with AND-matching

Create `src/app/api/booking/lookup-previous/route.ts`:

```ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/serviceClient'

const EMPTY = { bandName: null, equipmentIds: [] as string[] }

export async function POST(req: NextRequest) {
  // Rate limit check — see Step 3, inserted here
  const body = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''

  if (!email || !phone) {
    return NextResponse.json(EMPTY)
  }

  const supabase = createServiceClient()
  const { data } = await supabase
    .from('bookings')
    .select('band_name, booking_equipment(equipment_id)')
    .eq('customer_email', email)
    .eq('customer_phone', phone)
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) {
    return NextResponse.json(EMPTY)
  }

  return NextResponse.json({
    bandName: data.band_name,
    equipmentIds: (data.booking_equipment ?? []).map((be: { equipment_id: string }) => be.equipment_id),
  })
}
```

Note the `.eq(...).eq(...)` chain — this is AND matching, not the `.or(...)` used in the rejected prior attempt. Confirm this is correct by checking how case sensitivity is handled for `customer_email`/`customer_phone` elsewhere in the codebase (e.g. does `createBooking.ts` lowercase/trim before storing? Match that exact normalization here, or the AND match will silently fail for legitimately returning customers).

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: Add a simple in-memory rate limiter

Add a minimal per-IP (or per-email+phone-pair, whichever is simpler given what's available from `NextRequest`) rate limit inside the same route file — e.g. a `Map` tracking timestamps of recent requests per key, rejecting with a 429 if more than N (suggest N=5) requests arrive from the same key within a rolling window (suggest 60 seconds). Explicitly comment that this is in-memory and per-serverless-instance (won't hold state across Vercel's multiple function instances or cold starts) — a best-effort deterrent against casual guessing, not a hard guarantee. This matches the risk level accepted in "Residual risk" above; do not over-engineer this into a distributed rate limiter, that's explicitly out of scope.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 4: Wire it into DetailsForm.tsx

Add a debounced `fetch('/api/booking/lookup-previous', { method: 'POST', body: JSON.stringify({ email, phone }) })` call triggered once BOTH email and phone fields have values (e.g. on blur of whichever field is filled second). Render a small dismissable suggestion UI when a match is found (non-null `bandName` or non-empty `equipmentIds`), prefilling `band_name` and pre-selecting `equipmentIds` on accept. If the fetch returns a 429 (rate limited), fail silently — don't show an error to the customer, just skip the suggestion (this is a convenience feature, not a critical path; a rate-limited customer should still be able to complete their booking normally).

**Verify**: `npx tsc --noEmit` → exit 0.

## Test plan

If the matching/rate-limit logic can be reasonably extracted into pure functions (e.g. `src/lib/lookupPreviousBooking.ts` for the query-shaping logic, a small rate-limiter helper), add unit tests covering: exact email+phone match returns the booking; email-only or phone-only match returns `EMPTY`; no match returns `EMPTY`; most-recent-wins with multiple matching past bookings; rate limiter rejects the 6th request within the window and allows the 1st again after the window passes. If no live Supabase credentials are available in the executor's sandbox to run an integration test live, write the test file, confirm it typechecks, and clearly note the live-run limitation — do not skip writing the test.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm test:run` exits 0 (unaffected + new tests compile even if not runnable live)
- [ ] `grep -n "lookup-previous" src/components/booking/DetailsForm.tsx` shows it wired in
- [ ] `grep -n "createServiceClient" src/app/api/booking/lookup-previous/route.ts` confirms the service-role client is used
- [ ] `grep -n "\.eq('customer_email'" src/app/api/booking/lookup-previous/route.ts` AND `grep -n "\.eq('customer_phone'" ...` both present — confirms AND matching, not OR
- [ ] Rate-limit logic present in the route file (grep for whatever variable/function name Step 3 introduces)
- [ ] No files outside scope modified except the new route file and any extracted test helper(s) (expected)

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts (drift since this plan was written).
- `DetailsForm.tsx`'s current structure makes wiring in a debounced lookup genuinely awkward — report the specific difficulty rather than forcing a bad fit.
- You find yourself reverting to `.or(...)` matching or the anon `createClient()` for any part of this — the entire point of this rewrite is avoiding both. If either seems necessary, STOP and report rather than substituting.
- `customer_email`/`customer_phone` normalization (case, whitespace, phone format) isn't consistent with how `createBooking.ts` stores them — a mismatch here would make the AND-match silently fail for real returning customers, which defeats the feature; report the exact normalization found rather than guessing.

## Maintenance notes

- This plan's rate limiter is explicitly a stopgap — if the studio's traffic grows enough that in-memory-per-instance rate limiting stops being an effective deterrent (multiple serverless instances spreading requests around it), revisit with a real distributed rate limiter (Upstash Redis is the natural fit given this stack, and Vercel's marketplace already offers it per this project's dependency conventions).
- If the business ever scales past "small single-room studio with a small customer base," revisit the "Residual risk" acceptance above — the OTP/verification flow that was deliberately skipped here becomes worth the added complexity at that point.
- The dual-match (AND) design means a customer who moves and gets a new phone number, or who used a different email on a prior booking, won't get the prefill suggestion — this is an accepted false-negative tradeoff for the security benefit, not a bug.
