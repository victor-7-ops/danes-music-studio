# Plan 012: Add a lightweight "book again" suggestion for returning customers (no full accounts)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7879781..HEAD -- src/app/book src/lib/actions/createBooking.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3 (direction)
- **Effort**: M
- **Risk**: LOW — additive, no auth/schema changes to existing flows
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `7879781`, 2026-07-13

## Why this matters

There's no customer account or booking history in this app — every booking is looked up by a one-off confirmation code (`src/app/booking/[code]/page.tsx`), and `customer_email`/`customer_phone` are stored as plain text per-booking with no customer entity linking repeat visits. For a rehearsal studio whose business model depends on repeat bands, this means returning customers get zero convenience benefit from having booked before — they re-enter everything from scratch every time. Full accounts+auth is a large surface (auth flow, RLS policy changes, migration) that may be disproportionate for a small studio's actual need. This plan scopes the lightweight alternative: match on phone/email at the details step and offer to prefill the previous booking's band name/gear selection — most of the retention value, a fraction of the build cost, and it's abandonable without any schema migration if it doesn't prove useful.

## Current state

- `src/components/booking/DetailsForm.tsx` — where customers currently enter `customer_name`, `customer_email`, `customer_phone`, `band_name`, and equipment selection. Read this file in full before starting (not yet read in this session) to find the exact field names and the form's current submit flow.
- `src/lib/actions/createBooking.ts` — the fields referenced during audit: `params.email`, `params.phone` (lines ~114-115), plus `band_name`, equipment selection (`booking_equipment` insert). Read the full file to confirm the complete params shape.
- No existing lookup-by-contact-info query exists anywhere in the codebase (confirmed: this is a net-new read path, not modifying an existing one).
- RLS policies: per the correctness/security audit, anon `INSERT` on `bookings` is scoped by `WITH CHECK (status = 'pending' AND source = 'online' AND amount_paid = 0)` — a NEW read query (SELECT past bookings by phone/email) will need its own RLS policy allowing anon `SELECT` scoped narrowly (e.g. only `band_name`/equipment selections, NOT full booking history with amounts/other PII) or should go through a server action using the service-role-adjacent server client instead of exposing a new public anon-readable query. Prefer a server action (`'use server'`) that does the lookup server-side and returns only the minimal prefill fields, avoiding any new RLS surface entirely.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Tests     | `pnpm test:run`          | all pass            |

## Scope

**In scope**:
- New server action, e.g. `src/lib/actions/lookupPreviousBooking.ts` — takes `email` and/or `phone`, queries `bookings` for the most recent past booking matching either, returns ONLY `band_name` and the equipment names/ids from `booking_equipment` (explicitly NOT amounts, confirmation codes, or other bookings' details — minimize what's exposed to an unauthenticated lookup).
- `src/components/booking/DetailsForm.tsx` — after the customer enters email/phone (on blur, or a small debounce), call the new lookup action; if a match is found, show a small "Book again as [band name] with [equipment]?" prompt that prefills the rest of the form on accept, dismissable.

**Out of scope**:
- Any customer account/auth system — explicitly not building this.
- Any change to `bookings`/`booking_equipment` schema.
- Any change to the admin-side booking views.
- Full booking history display to the customer (e.g. a "my bookings" page) — this plan is scoped to a single-field prefill suggestion, not a history feature.

## Git workflow

- Branch: `advisor/012-quick-rebook`
- Commit per step; message style matches `git log`
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Read `DetailsForm.tsx` and `createBooking.ts` in full

Confirm the exact field names, form state shape, and submit flow before writing the lookup action or the UI hook.

**Verify**: no command — research step.

### Step 2: Write the lookup server action

Create `src/lib/actions/lookupPreviousBooking.ts`:

```ts
'use server'

import { createClient } from '@/lib/supabase/server'

export interface PreviousBookingSuggestion {
  bandName: string | null
  equipmentIds: string[]
}

export async function lookupPreviousBooking(
  email: string,
  phone: string
): Promise<PreviousBookingSuggestion | null> {
  const trimmedEmail = email.trim().toLowerCase()
  const trimmedPhone = phone.trim()
  if (!trimmedEmail && !trimmedPhone) return null

  const supabase = await createClient()
  // Match on either — most recent booking wins. Explicitly select only the
  // fields this feature needs; do not select amounts, confirmation codes,
  // or other PII beyond what's already visible to the customer entering
  // their own contact info.
  const query = supabase
    .from('bookings')
    .select('band_name, booking_equipment(equipment_id)')
    .or(
      [
        trimmedEmail ? `customer_email.eq.${trimmedEmail}` : null,
        trimmedPhone ? `customer_phone.eq.${trimmedPhone}` : null,
      ]
        .filter(Boolean)
        .join(',')
    )
    .order('start_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await query
  if (error || !data) return null

  return {
    bandName: data.band_name,
    equipmentIds: (data.booking_equipment ?? []).map((be: { equipment_id: string }) => be.equipment_id),
  }
}
```

Adjust the exact Supabase `.or()` filter syntax if this repo's Supabase client version formats it differently — verify against another existing multi-condition query in the codebase for the correct syntax pattern before trusting this snippet verbatim.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 3: Wire the lookup into `DetailsForm.tsx`

Add a debounced call to `lookupPreviousBooking` when both email and phone fields have been filled (or on blur of the second one filled), and render a small dismissable suggestion banner when a match is found. On accept, prefill `band_name` and pre-select the returned `equipmentIds` in the form state.

**Verify**: `npx tsc --noEmit` → exit 0.

## Test plan

- Unit test for `lookupPreviousBooking`: matches by email, matches by phone, no match returns `null`, most-recent-wins when multiple past bookings exist for the same contact info. Follow the integration-test pattern from plan 005 (`src/lib/__tests__/bookings.test.ts` precedent) since this touches real Supabase.
- Manual: complete a booking with a test email/phone, then start a new booking with the same contact info, confirm the suggestion banner appears with the correct band name and equipment; confirm it does NOT appear for a fresh email/phone with no history.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm test:run` / `pnpm test:integration` exits 0 including new `lookupPreviousBooking` tests
- [ ] `grep -n "lookupPreviousBooking" src/components/booking/DetailsForm.tsx` shows it wired in
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated
- [ ] Manual verification completed

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match what Step 1's fresh read reveals — adjust the plan to the actual current form structure rather than forcing the snippet above verbatim.
- The lookup query's `.or()` filter syntax doesn't work as written against this repo's actual Supabase client version — find the correct syntax from another existing query in the codebase rather than guessing further.
- Any existing RLS policy would need to be loosened to make this lookup work as a client-callable query — it must NOT be; if the server action approach above (server-side, not exposed as a public anon-readable table query) doesn't avoid this, STOP and report rather than weakening RLS.

## Maintenance notes

- This is intentionally the minimal version of "customer memory" — if usage data later shows customers want to see full booking history (not just a one-field prefill), that's a bigger feature requiring the account/auth design tradeoff noted in the original audit finding — treat this plan as a cheap experiment, not the final word on customer accounts.
- If email/phone matching produces false-positive suggestions (e.g. shared phone numbers across different bands), consider tightening the match or requiring exact match on both fields rather than either — monitor after launch.
