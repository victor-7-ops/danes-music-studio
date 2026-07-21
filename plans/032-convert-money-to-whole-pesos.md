# 032 — Convert money storage from integer centavos to integer whole pesos

Planned at commit `74c9a3d`. Read this fully before starting — this touches
every money-handling path in the app and is high-risk if done partially.

## Priority / Effort

P1 (deliberate architecture change, owner-requested 2026-07-21) / L

## Why this matters

Every price in this app (₱350/hr Rehearsal, ₱1,000/hr Recording, equipment
fees, deposits) has always been a whole peso amount in practice — the
studio owner confirmed no transaction has ever needed sub-peso precision.
Storing money as integer centavos (the current convention, CLAUDE.md
invariant 3) adds a conversion layer (`* 100` / `/ 100`) at every boundary
that has already caused one live pricing bug (see
`plans/README.md` and commit `74c9a3d` — a migration double-multiplied
Rehearsal's rate by 100, charging ₱35,000/hr instead of ₱350/hr for an
unknown period). The owner's call: simplify to integer whole pesos
everywhere, accepting the loss of sub-peso precision as a non-issue given
actual usage.

**This remains integer arithmetic, never floats** — CLAUDE.md's core
invariant (no float money math) is unchanged, only the unit each integer
represents changes from "centavos" to "pesos."

## Current state — money columns and their conversion points

Confirmed via live schema query (2026-07-21), 7 columns across 5 tables,
all currently `integer`, storing centavos:

| Table | Column | Current example value | Meaning |
|---|---|---|---|
| `bookings` | `total_amount` | varies | booking total, centavos |
| `bookings` | `deposit_amount` | varies | deposit due, centavos |
| `bookings` | `amount_paid` | varies | amount actually paid, centavos |
| `service_types` | `rate_per_hour` | `35000` (Rehearsal), `100000` (Recording) | hourly rate, centavos |
| `payments` | `amount` | varies (PayMongo table, currently unwired — see HANDOFF.md) | centavos |
| `equipment` | `price_per_session` | varies | equipment fee, centavos |
| `booking_equipment` | `price_at_booking` | varies | price snapshot, centavos |

22 files reference `* 100`, `/ 100`, `formatPHP`, or "centavo" (found via
`grep -rln "\* 100\|/ 100\|formatPHP\|centavo" src`) — read every one of
them during this plan, don't assume the list above is exhaustive; re-run
that grep yourself first since the codebase has moved since this plan was
written.

## Scope

**In scope**:
1. New migration converting all 7 columns' existing data from centavos to
   whole pesos (divide by 100 — every current value is a multiple of 100
   already, per the owner's confirmation that no centavo-precision
   transaction has ever occurred; verify this assumption against live data
   before the migration, see Step 1).
2. Every server action, page, and component that currently does
   `value * 100` (pesos-input → centavos-storage) or `value / 100`
   (centavos-storage → pesos-display) for money — remove the conversion
   entirely; the stored integer IS the peso amount now.
3. `src/lib/emails/format.ts`'s `formatPHP` (or equivalent) — update to
   format a whole-peso integer directly (e.g. `₱1,234` via
   `toLocaleString('en-PH')`, no `/100` first).
4. Email templates, Telegram messages, PayMongo integration (unwired but
   keep it internally consistent — don't leave it assuming centavos while
   everything else assumes pesos), Google Calendar event descriptions —
   anywhere a money value is formatted for a human.
5. All existing tests that assert specific centavo values — update to
   whole-peso equivalents (divide expected values by 100, don't just change
   the assertion style).
6. `CLAUDE.md` — update invariant 3's wording from "integer centavos" to
   "integer whole pesos, never floats."
7. Any doc referencing centavos (`HANDOFF.md`, `README.md`, comments
   throughout `src/`) — update terminology.

**Out of scope**:
- Do NOT introduce floats or decimals anywhere — this is integer-pesos,
  not decimal-pesos. `Math.round`/`Math.floor` still apply wherever a
  percentage (e.g. `deposit_pct`) is multiplied against a peso amount, same
  as today's centavo math, just on smaller numbers.
- Do NOT touch `deposit_pct`'s representation (stays a fraction like
  `0.500`) — only the money *amount* columns convert, not percentages.
- Do NOT change anything about the recently-fixed `service_types` rates
  beyond their unit — Rehearsal must end up as `350`, Recording as `1000`
  after conversion, not some other value.
- Do NOT touch unrelated non-money integer columns (e.g. `quantity`,
  `occurrence_count`).

## Steps

### Step 1: Verify every stored money value is actually a multiple of 100

Before writing the migration, run this against the live DB to confirm the
owner's assumption holds for ALL historical data, not just current
service_types rates:

```sql
SELECT 'bookings.total_amount' AS col, count(*) FROM bookings WHERE total_amount % 100 != 0
UNION ALL SELECT 'bookings.deposit_amount', count(*) FROM bookings WHERE deposit_amount % 100 != 0
UNION ALL SELECT 'bookings.amount_paid', count(*) FROM bookings WHERE amount_paid % 100 != 0
UNION ALL SELECT 'service_types.rate_per_hour', count(*) FROM service_types WHERE rate_per_hour % 100 != 0
UNION ALL SELECT 'payments.amount', count(*) FROM payments WHERE amount % 100 != 0
UNION ALL SELECT 'equipment.price_per_session', count(*) FROM equipment WHERE price_per_session % 100 != 0
UNION ALL SELECT 'booking_equipment.price_at_booking', count(*) FROM booking_equipment WHERE price_at_booking % 100 != 0;
```

**If any count is nonzero**: STOP. That row has genuine sub-peso precision
(e.g. an admin once entered ₱150.50 as `15050` centavos) and a straight
`/100` migration would silently truncate/round real money data. Report the
exact table/column/row(s) back rather than rounding silently — the owner
needs to decide how to handle that specific historical value before this
migration can proceed.

**Verify**: all 7 counts are 0 before continuing.

### Step 2: Write the schema migration

New migration (next available number after `20260026000000`):

```sql
ALTER TABLE bookings ALTER COLUMN total_amount TYPE integer USING (total_amount / 100);
ALTER TABLE bookings ALTER COLUMN deposit_amount TYPE integer USING (deposit_amount / 100);
ALTER TABLE bookings ALTER COLUMN amount_paid TYPE integer USING (amount_paid / 100);
ALTER TABLE service_types ALTER COLUMN rate_per_hour TYPE integer USING (rate_per_hour / 100);
ALTER TABLE payments ALTER COLUMN amount TYPE integer USING (amount / 100);
ALTER TABLE equipment ALTER COLUMN price_per_session TYPE integer USING (price_per_session / 100);
ALTER TABLE booking_equipment ALTER COLUMN price_at_booking TYPE integer USING (price_at_booking / 100);
```

Confirm each column's actual current type/constraints (`NOT NULL`, `CHECK`,
defaults) via the live schema before writing the final migration — preserve
every existing constraint, this ALTER should only change stored values and
must not silently drop a `NOT NULL` or `CHECK (>= 0)` constraint. Read the
original CREATE TABLE / ALTER TABLE migrations for each of these 5 tables
first.

**Verify**: after applying (to a review/staging step, not production yet —
see Git workflow), re-run Step 1's query pattern but check the NEW values
divide evenly into the OLD values by 100 for a sample of rows, and spot
check `service_types` shows `Rehearsal = 350`, `Recording = 1000`.

### Step 3: Update every server action and library function

Work through the full file list from the grep in "Current state" (re-run
it fresh). For each file, the pattern is almost always: remove a
`Math.round(x * 100)` at a money-input boundary, or remove a `/ 100` at a
money-display boundary. Do NOT leave any stray `* 100`/`/ 100` — a single
missed conversion site is exactly how the `20260014000000` bug happened
originally (see "Why this matters"). Cross-check each file against its
counterpart action (e.g. if `createBooking.ts` computes
`total_amount = hours * rate_per_hour`, and both `hours` and `rate_per_hour`
are now peso-denominated, the result is correctly peso-denominated with NO
`/100` needed anywhere in that computation — verify this is true for every
computation chain, not just the top-level input/output).

Pay special attention to:
- `src/lib/slotSelection.ts`'s `computeTotal()` — the shared pricing
  function used by `createBooking.ts`, `createWalkIn.ts`, `createOnsite.ts`,
  and `createRecurringBooking.ts`. Fixing this one function correctly is
  the highest-leverage single change in this plan.
- `src/lib/emails/format.ts` (`formatPHP` or equivalent) and
  `src/lib/emails/templates/confirm.html.ts` — customer-facing amounts.
- `src/lib/telegram.ts` and `src/lib/gcal/pushSync.ts` — admin-facing
  amounts in notifications/calendar events.
- `src/components/admin/StudioSettingsForm.tsx` and
  `src/lib/actions/admin/updateSettings.ts` — the admin rate-entry form;
  confirm the input field now takes/displays a whole-peso number with no
  `* 100` before storage.
- `src/components/admin/EquipmentPanel.tsx` and
  `src/lib/actions/admin/equipment.ts` — equipment price entry, same
  pattern.
- `src/app/api/webhooks/paymongo/route.ts` and `src/lib/paymongo.ts` — even
  though PayMongo is unwired (don't re-enable it), keep its money handling
  internally consistent with the rest of the codebase so it isn't a
  landmine if ever re-enabled; PayMongo's own API expects centavos
  (`amount` in centavos per their API docs) — if you update this file,
  clearly comment that a `* 100` conversion is REQUIRED here specifically
  when calling PayMongo's API, precisely because PayMongo's wire format is
  centavos while this app's internal storage is now pesos. Do not remove
  that specific conversion; it would be a different bug if PayMongo is ever
  re-enabled without it.

**Verify** after each file: `npx tsc --noEmit` still passes (run
incrementally, not just once at the end, so a mistake in file 3 doesn't get
buried under 19 more files of changes).

### Step 3b: Fix bookings.test.ts's test-data cleanup (found during Step 1's pre-flight check)

`src/lib/__tests__/bookings.test.ts` inserts real rows into the live
`bookings` table (hardcoded `total_amount: 350.00`, `deposit_amount:
175.00` — coincidentally correct-looking post-migration but wrong today)
and its `afterAll` only sets `status: 'cancelled'`, never deletes the rows.
This was caught during this plan's Step 1 pre-flight (two leftover rows
from 2026-07-21 test runs, already manually cleaned up before this plan
was executed). Fix the cleanup to `DELETE` instead of cancel-update, so
future integration test runs don't permanently accumulate rows in
production. Small, unrelated-to-money-units fix — do it here since you're
already touching this file's money literals in Step 4.

### Step 4: Update every test

Every test asserting a specific money value needs its expected value
divided by 100 (e.g. `expect(total_amount).toBe(3500000)` becomes
`expect(total_amount).toBe(350)`), not just re-styled. Grep test files for
numeric literals that look like centavo amounts (5-7 digit numbers next to
`amount`/`price`/`rate`/`deposit`) and verify each one against the new
whole-peso reality. This includes `src/lib/__tests__/supabaseMock.ts`-based
tests (`createBooking.test.ts`, `confirmDeposit.test.ts`,
`createOnsite.test.ts`, `equipment.test.ts`,
`createRecurringBooking.test.ts`) and the pure-function tests
(`slotSelection.test.ts`, `bookings.test.ts`).

**Verify**: `npm run test:run` passes with zero skipped/deleted tests.

### Step 5: Update docs

- `CLAUDE.md` invariant 3: change wording from centavos to whole pesos,
  keep the "never floats" language unchanged.
- `HANDOFF.md`: same terminology update wherever it mentions centavos.
- `README.md`: same, if it mentions the money-storage convention.
- Inline code comments throughout `src/` that say "centavos" — update to
  "pesos" (search for the literal word).

### Step 6: Manual regression walkthrough

This is a money-correctness change touching every price shown to
customers and admins — typecheck/tests are necessary but not sufficient.
Run `pnpm dev` and manually verify actual displayed numbers (not just "no
crash"):

1. `/book` → complete a Rehearsal booking — confirm total shows ₱350/hr ×
   hours, deposit shows 50% of that, both as clean whole-peso amounts (no
   stray `.00` unless that's the intended display format — confirm against
   `formatPHP`'s new implementation).
2. Same for a Recording booking — confirm ₱1,000/hr.
3. Add an equipment item at a known price in `/admin/settings`, confirm it
   displays and adds correctly to a booking total.
4. `/admin/dashboard` — confirm revenue/outstanding/projected figures are
   sane whole-peso amounts, not off by 100x in either direction.
5. Confirm a booking via `/admin` → `confirmDeposit` flow, verify the
   stored `amount_paid` and the confirmation email's displayed amount match
   and are correct.
6. Check the Telegram notification (if testable) and Google Calendar event
   description (if testable) show correct amounts.

**Verify**: every displayed amount matches manual hand-calculation
(`rate_per_hour × hours × deposit_pct`, etc.) — no 100x, no missing/extra
conversion anywhere.

## Git workflow

- Branch: `migration/032-whole-pesos`
- This migration should be tested against a way to verify the `ALTER
  COLUMN ... USING` transform before running it on the live production
  database with real historical booking data — if this session has no safe
  staging/local Supabase instance to rehearse against, at minimum dry-run
  the `USING` expression as a `SELECT` first (`SELECT total_amount / 100
  FROM bookings LIMIT 20` etc.) and manually eyeball the results before
  running the real `ALTER TABLE`.
- Do NOT push or apply the migration to the live database without human
  confirmation given this converts real historical money data — flag this
  explicitly as a checkpoint before Step 2's migration is actually run
  against production, even though earlier plans in this session applied
  their migrations automatically. Money-value-mutating migrations on
  existing rows are a different risk class than additive schema changes
  (new tables/columns), which is what every prior migration this session
  did.

## Test plan

Covered in Step 4 (update existing tests) — no fundamentally new test
scenarios are needed since this changes a value's unit, not the logic
around it. If any test was previously skipped/weak on money-value
assertions, this is a natural moment to tighten it, but that's optional,
not required for this plan's completion.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] Step 1's verification query returns all zeros (or the owner
      explicitly resolved any nonzero finding before proceeding)
- [ ] All 7 columns converted, `service_types` shows `Rehearsal = 350`,
      `Recording = 1000`
- [ ] Zero remaining `* 100`/`/ 100` money-conversion sites outside the
      one intentional PayMongo-API-boundary exception (Step 3)
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run test:run` passes, no tests skipped/deleted to force a pass
- [ ] Manual walkthrough (Step 6) confirms correct displayed amounts
      end-to-end
- [ ] `CLAUDE.md`, `HANDOFF.md` updated to whole-peso terminology
- [ ] Migration applied to live DB only after explicit human confirmation

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 finds any historical row with genuine sub-peso precision — this
  needs an owner decision, not a rounding choice made unilaterally.
- Any money computation chain is ambiguous about whether an intermediate
  value is still centavos or already pesos partway through a refactor —
  report the specific file/function rather than guessing and risking
  another 100x-class bug.
- PayMongo's webhook/API integration code can't be updated in a way that
  keeps its wire-format conversion (pesos-internal → centavos-for-PayMongo)
  cleanly isolated — report rather than leaving an ambiguous half-converted
  state in unwired-but-present code.

## Maintenance notes

- This plan intentionally keeps PayMongo's integration internally
  consistent (still centavos at the API boundary) even though it's unwired
  — if PayMongo is ever re-enabled, whoever does that work needs to know
  this app's internal representation is pesos and PayMongo's wire format is
  centavos, and that boundary conversion is the ONLY place `* 100` should
  exist in the money-handling codebase going forward.
- If the studio ever needs sub-peso pricing in the future (unlikely per the
  owner's stated usage pattern, but worth noting), reverting to centavos
  (or moving to decimal/numeric columns) would be the fix at that point —
  don't build speculative support for it now.
