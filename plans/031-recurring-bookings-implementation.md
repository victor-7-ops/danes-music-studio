# 031 — Implement recurring bookings (weekly, fixed-N, per-occurrence payment)

Planned at commit `2b40cf3`. Read `plans/013-recurring-bookings-spike.md` and
`plans/013a-recurring-bookings-design.md` in full before starting — this
plan is the direct implementation of 013a's recommendations, all six design
questions already answered there. This plan does not re-derive those
answers; it specifies the concrete build.

## Priority / Effort

P2 (validated direction, design complete, no more blockers) / L

## Decisions locked (from 013a + owner input, 2026-07-21)

- **Q1 — Recurrence scope**: weekly only. `recurrence_pattern` field
  constrained to `'weekly'` for v1 (enum or check constraint), not
  hardcoded elsewhere, so it's extensible later.
- **Q2 — Series length**: fixed N occurrences chosen at booking time, cap at
  26 (confirm this cap still makes sense when you implement the UI — it's a
  sanity bound, not a business rule handed down from anywhere).
- **Q3 — Partial-conflict behavior**: validate all N occurrences against
  existing bookings before inserting anything. Any conflict rejects the
  whole series with the conflicting date(s) shown to the customer. No
  partial series ever gets created.
- **Q4 — Deposit/payment model: Option B — per-occurrence payment.** Every
  occurrence is a normal `bookings` row with its own `confirmation_code`,
  `payment_method`, `payment_proof_url`, deposit, and admin-confirm flow —
  identical to a one-off booking today. **This means `book/pay/page.tsx`,
  `api/bookings/proof/route.ts`, `confirmDeposit.ts`, and the admin
  confirm-payment UI need zero changes.** Do not touch any of those files
  in this plan — if you find yourself wanting to, STOP, you've drifted from
  Option B into Option A/C territory and that's out of scope.
- **Q5 — Cancellation semantics**: single-occurrence cancel needs no new
  code (existing `cancelBooking.ts` / `api/booking/cancel/route.ts` already
  operate per-row via `id`/`cancel_token`). Add a "cancel entire series"
  bulk action that loops the existing per-row cancel logic — no new
  cancellation primitive.
- **Q6 — Schema shape**: new `booking_series` table + nullable `series_id`
  FK on `bookings`. Money fields stay on individual `bookings` rows (this is
  what makes Q4's Option B trivial — don't add money fields to
  `booking_series`).

## Scope of this plan

Build the full customer-facing recurring-booking flow plus the minimum
admin-side "cancel whole series" action. Read the actual current customer
booking flow (`src/app/book/**`, `src/lib/actions/createBooking.ts`,
`src/lib/slotSelection.ts`) and current schema
(`supabase/migrations/**`, especially `20260020000000_equipment_quantity.sql`
and the `bookings_no_overlap` EXCLUDE constraint migration) before writing
code — this plan describes shape and sequencing, not exact line-by-line
diffs, since the codebase has moved since this plan was written.

### 1. Schema migration

New migration (next available number after
`20260024000000_pg_cron_extension_self_sufficient.sql`):

```sql
CREATE TABLE booking_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurrence_pattern text NOT NULL DEFAULT 'weekly' CHECK (recurrence_pattern = 'weekly'),
  occurrence_count integer NOT NULL CHECK (occurrence_count > 0 AND occurrence_count <= 26),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bookings ADD COLUMN series_id uuid REFERENCES booking_series(id);
CREATE INDEX bookings_series_id_idx ON bookings(series_id) WHERE series_id IS NOT NULL;
```

Confirm the exact `bookings` table columns and existing constraints
(`bookings_no_overlap`, any RLS policies) via
`supabase/migrations/**` before writing this — don't assume the shape above
is complete, it's 013a's sketch, cross-check against the live schema.

### 2. Server action: `createRecurringBooking`

New file `src/lib/actions/createRecurringBooking.ts`, modeled on
`src/lib/actions/createBooking.ts` (read it in full first — reuse its
patterns for rate/deposit lookup, equipment handling, and error shapes
rather than inventing new ones):

- Accepts an anchor date/time + weekly cadence + `occurrence_count`, plus
  the same customer-details/equipment params as `createBooking`.
- Computes all N `(start_at, end_at)` pairs server-side (don't trust a
  client-computed list — same principle as existing "server computes price"
  invariant, applied to dates here).
- Pre-check: single query (or N small queries) checking all N ranges against
  existing non-cancelled bookings — reuse the overlap-detection approach
  already proven in `createBooking.ts` / `equipmentAvailability.ts` rather
  than reimplementing range-overlap logic from scratch.
- If any occurrence conflicts, return `{ success: false, error, conflicts:
  [...dates] }` — insert nothing.
- If clean: insert one `booking_series` row, then insert N `bookings` rows
  (each with `series_id` set, each computing its own
  `total_amount`/`deposit_amount` via the existing per-occurrence money
  logic — same as a one-off booking) in a single transaction/multi-row
  insert. The `bookings_no_overlap` EXCLUDE constraint remains the
  authoritative backstop for the race window between pre-check and insert
  — same pattern `createBooking.ts` already relies on for single bookings.
- If equipment is selected: this is where recurring bookings compound risk
  with plan 016's `reserve_equipment` RPC — each occurrence needs its own
  equipment reservation. Loop the RPC call once per occurrence inside the
  same transaction; if any occurrence's equipment is unavailable, treat it
  identically to a date conflict (reject the whole series, report which
  occurrence). Do not attempt to reserve equipment for N occurrences in a
  single RPC call — `reserve_equipment` is scoped to one booking_id per
  call by design (see `20260022000000_equipment_atomic_reserve.sql`);
  extending its signature is out of scope for this plan.

### 3. Customer-facing UI

Extend the existing booking flow (`src/app/book/**`) with a "make this
recurring" step — read the current flow's page/component structure first
and follow its existing patterns for state threading between steps
(URL params, per the pattern already used for `service`/`equipment`).
Minimum UI needed:
- Toggle: one-time vs. recurring.
- If recurring: weekly cadence is implicit (Q1), just need occurrence count
  input (bounded 1–26).
- Conflict display: if `createRecurringBooking` returns conflicting dates,
  show them clearly — this is the UX payoff of Q3's pre-check.
- Payment: **unchanged from today** — after the series is created, the
  customer is routed through the existing `book/pay` flow, but now once per
  occurrence (Option B). Confirm the redirect target after series-creation
  makes sense given N confirmation codes now exist instead of one — likely
  redirect to a new lightweight "your series is booked, pay for each
  session as it approaches" summary page listing all N confirmation codes,
  rather than trying to shoehorn N codes through the existing single-code
  `book/pay?code=...` URL shape.

### 4. Admin "cancel whole series" action

New admin action (e.g. `src/lib/actions/admin/cancelSeries.ts`), thin
wrapper: look up all `bookings` rows sharing a `series_id`, call the
existing `cancelBooking.ts` logic per row (loop, not a bulk `UPDATE`, since
existing per-row cancel logic has side effects — email, gcal delete — that
must fire per occurrence per 013a's Q5 recommendation). Surface this as a
button somewhere sensible in the admin bookings UI (find the existing
per-booking cancel UI and add an adjacent "cancel entire series" action when
`series_id` is present).

## Files in scope

- New migration for `booking_series` + `bookings.series_id`.
- `src/lib/actions/createRecurringBooking.ts` (new).
- `src/lib/actions/admin/cancelSeries.ts` (new).
- Customer booking flow UI additions under `src/app/book/**` and
  `src/components/booking/**`.
- Admin bookings UI — add the "cancel series" action only, minimal touch.

## Files explicitly out of scope

- `book/pay/page.tsx`, `api/bookings/proof/route.ts`, `confirmDeposit.ts` —
  Option B means these need zero changes. Touching them is a signal you've
  drifted out of scope.
- `cancelBooking.ts` — reused as-is via the loop in `cancelSeries.ts`, not
  modified.
- Equipment CRUD, `reserve_equipment`'s signature — reused per-occurrence,
  not extended.

## Verification

1. `npm run typecheck` and `npm run test:run` pass.
2. New tests for `createRecurringBooking`: happy path (N rows + 1 series
   row inserted, correct dates), full-series rejection on a single
   conflicting occurrence (assert zero rows inserted), equipment
   unavailable on one occurrence rejects the whole series. Follow the
   mock-Supabase-client pattern established in plan 019's test suite
   (`src/lib/__tests__/supabaseMock.ts`) rather than inventing a new one.
3. Manual test: book a 4-week recurring series with no conflicts, confirm 4
   bookings + 1 series row exist, each with its own confirmation code and
   independent pay/confirm flow. Cancel one occurrence, confirm the other 3
   are unaffected. Cancel the whole series, confirm all 4 cancel with their
   individual side effects (email, gcal) each firing.
4. Manual test: book a recurring series where week 3 conflicts with an
   existing booking, confirm the whole series is rejected and the customer
   sees week 3 flagged as the conflict, and confirm zero rows were inserted
   (check the DB directly, not just the UI response).

## Done criteria

- Customer can book a weekly recurring series (1–26 occurrences), each
  occurrence individually priced/paid/confirmed exactly like a one-off
  booking.
- Any single-occurrence conflict (time or equipment) rejects the entire
  series atomically — verified by DB inspection, not just the returned
  error.
- Admin can cancel a whole series in one action, with per-occurrence side
  effects (email, gcal delete) firing correctly.
- `book/pay/page.tsx`, `api/bookings/proof/route.ts`, `confirmDeposit.ts`
  unchanged (diff them against `main` at the end — if any of the three has
  a diff, that's a scope violation, revert it).

## Maintenance note

If the studio later wants Option A/C (pay-once-for-series), 013a's schema
already anticipated this — the follow-up would add money fields to
`booking_series` as a second migration without touching this plan's base
shape. That's a future plan, not something to build defensively now.
