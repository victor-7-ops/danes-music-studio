# Plan 011: Prevent double-booking a single piece of equipment across overlapping sessions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7879781..HEAD -- src/lib/actions/createBooking.ts src/lib/actions/admin/createWalkIn.ts src/lib/actions/admin/equipment.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3 (direction — confirm with the studio owner whether any equipment is single-quantity before prioritizing)
- **Effort**: M
- **Risk**: MED — touches the booking-write path where race conditions matter (same class of risk as the room-overlap constraint)
- **Depends on**: none (but conceptually follows from the equipment feature already being live)
- **Category**: direction
- **Planned at**: commit `7879781`, 2026-07-13

## Why this matters

The `equipment` table (see `src/lib/actions/admin/equipment.ts`) has no quantity/inventory-count field — `createEquipment`/`updateEquipment` only track `name`, `price_per_session`, and `active`. `booking_equipment` rows attach gear to a specific booking (`src/lib/actions/createBooking.ts:148`), but nothing checks whether a specific equipment item is already assigned to another booking that overlaps in time. If the studio owns only one of something (a specific amp, a specific mic), two customers can currently rent it for overlapping time slots with no warning from the system — the room-level `bookings_no_overlap` constraint has no awareness of equipment at all. This is a direction item, not a confirmed bug: its priority depends on whether the studio actually owns single-unit gear today. **Before implementing, confirm with the studio owner (or check current equipment inventory in the `equipment` table) whether any item is genuinely single-quantity** — if everything the studio rents has enough units that overlap is never physically possible, this plan should be deprioritized or rejected.

## Current state

- `src/lib/actions/admin/equipment.ts` — full file, read during audit (81 lines). `equipment` table columns used: `name`, `price_per_session`, `active` (and implicitly `id`, `created_at`, `sort_order` per the settings page query). No quantity column.
- `src/lib/actions/createBooking.ts:140-160` (approximate — read the file fresh, only a narrow grep match was seen) — where `booking_equipment` rows are inserted per booking. Read this file in full before starting; identify exactly how equipment selection flows from the customer-facing `DetailsForm.tsx` through to this insert.
- `supabase/migrations/` — the `bookings_no_overlap` EXCLUDE constraint (see `20260015000000_9_1_overlap_include_completed.sql` and whatever migration originally created it) is scoped to the `bookings` table's `start_at`/`end_at` range per room — it has no per-equipment dimension. A new constraint or application-level check is needed specifically for equipment overlap.
- `src/components/booking/DetailsForm.tsx` and `src/components/booking/ReviewSummary.tsza` (or `.tsx`) — where customers currently select equipment add-ons; read these to understand the current UX before adding a conflict warning to it.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Tests     | `pnpm test:run` / `pnpm test:integration` | all pass |

## Scope

**In scope**:
- Decide (Step 1) between two designs: (A) a `quantity` column on `equipment` allowing N concurrent bookings of the same item, checked at booking time by counting overlapping `booking_equipment` rows against `quantity`; or (B) a simpler binary "1 unit, no overlap allowed" EXCLUDE-constraint-style check per equipment item, matching the room-booking pattern. Pick based on what Step 1's stakeholder input reveals about actual inventory.
- A new Supabase migration adding whichever schema change Step 1's design needs.
- `createBooking.ts` and `createWalkIn.ts` (and `createOnsite.ts` if it also attaches equipment — check during Step 2) — add the conflict check before inserting `booking_equipment` rows.
- Customer-facing UX: surface "this item is already booked for your selected time" before checkout, not just as a server-side rejection after submission (better UX, matches how room-slot conflicts are already surfaced in `SlotGrid`).

**Out of scope**:
- Any change to equipment pricing logic.
- The admin equipment CRUD UI itself (already exists in `admin/settings/page.tsx` — this plan only adds inventory/conflict awareness, not new CRUD screens), unless the chosen design needs a `quantity` input added to the existing create/edit form, in which case that's the minimum necessary addition.

## Git workflow

- Branch: `advisor/011-equipment-conflict-check`
- Commit per step; message style matches `git log`
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Confirm the problem is real before building — check with the studio owner or current data

Query the `equipment` table (via Supabase dashboard or a read-only script) to see how many rows exist and whether the studio owner has indicated (in `HANDOFF.md`, commit history, or by direct ask) that any item is single-unit. **If this can't be confirmed and no stakeholder is reachable, default to NOT implementing this plan yet — instead, add a one-line note to `plans/README.md`'s "Findings considered and rejected" section explaining it's deferred pending inventory confirmation, and stop here.** Don't build speculative inventory-tracking infrastructure for a problem that may not exist in practice.

**Verify**: a clear decision recorded (proceed with design A, design B, or defer) with the reasoning written down.

### Step 2: (Only if Step 1 says proceed) Design the schema change

Based on Step 1's finding, write a migration adding either a `quantity` column (design A, default `1` for backward compatibility) to `equipment`, or rely on `quantity = 1` implicitly and just add the overlap check (design B is a subset of A with quantity hardcoded to 1 — recommend implementing A even if all current items are quantity 1, since it generalizes without extra later migration work).

**Verify**: migration file created following this repo's existing migration naming/style (see `supabase/migrations/20260015000000_9_1_overlap_include_completed.sql` as the most recent example of style/format).

### Step 3: Add the conflict check to booking creation

In `createBooking.ts` (and `createWalkIn.ts`/`createOnsite.ts` if applicable), before inserting `booking_equipment` rows, query for existing `booking_equipment` rows joined to `bookings` with overlapping `start_at`/`end_at` and the same `equipment_id`, count them, and reject if count >= the equipment's `quantity`.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 4: Surface the conflict in the customer-facing UI before submission

Read `DetailsForm.tsx`/`ReviewSummary` to find where equipment selection happens, and add a pre-submission availability check (similar in spirit to how room-slot availability is checked via `/api/availability` before the customer reaches checkout) so customers see "unavailable for your selected time" rather than a late server rejection.

**Verify**: manual — walk the booking flow, select a quantity-1 item, attempt to book it twice for overlapping times in two browser sessions, confirm the second attempt is rejected with a clear message.

## Test plan

- Unit/integration test for the new overlap-check query logic (wherever it lives — likely a new function in `src/lib/availability.ts` or similar, following that file's existing pure-function-plus-thin-wrapper pattern).
- Cover: equipment with `quantity: 1` rejects a second overlapping booking; `quantity: 2` allows exactly 2 concurrent, rejects a 3rd; non-overlapping times never conflict regardless of quantity.
- Verification: `pnpm test:integration` → all pass including new cases.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] Step 1's decision is recorded (proceed or defer) — if deferred, done criteria are just the `plans/README.md` note, nothing else in this plan applies.
- [ ] (If proceeding) `npx tsc --noEmit` exits 0
- [ ] (If proceeding) `pnpm test:integration` exits 0 including new conflict-check tests
- [ ] (If proceeding) manual verification in Step 4 completed
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 1 can't be resolved one way or the other (no stakeholder reachable, no clear signal in existing data/docs) — default to deferring per Step 1's instructions rather than guessing.
- The chosen design in Step 2 would require changing the shape of `booking_equipment` in a way that breaks existing bookings' historical records — if so, report the conflict and propose an additive-only schema change instead.

## Maintenance notes

- If the studio later adds genuinely high-quantity consumable-style equipment (e.g. cables, picks) where conflict-checking makes no sense, the `quantity` field's semantics should be revisited — this plan assumes equipment is discrete, reservable gear (amps, mics, drum kits), not consumables.
- This is explicitly a "confirm the problem before building" plan — resist the urge to build the full feature speculatively if Step 1 can't confirm real demand.
