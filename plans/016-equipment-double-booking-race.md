# 016 — Fix equipment double-booking race condition

Planned at commit: `02be9c6`. If HEAD has moved, re-verify the excerpts
below against `src/lib/actions/createBooking.ts` before starting (drift
check) — this is booking-critical code and likely to keep changing.

## Priority / Effort

P1 (data-integrity bug, can double-book physical gear) / M

## Problem

`src/lib/actions/createBooking.ts:108-144` checks equipment availability and
inserts the new booking as two separate, non-transactional steps:

```ts
// 5b. Equipment conflict check — single-unit (or quantity-limited) gear:
if (selectedEquipment.length > 0) {
  const { data: usageRows, error: usageError } = await supabase
    .from('booking_equipment')
    .select('equipment_id, bookings!inner(status, start_at, end_at)')
    .in('equipment_id', selectedEquipment.map(item => item.id))
    .neq('bookings.status', 'cancelled')
  // ... compute `unavailable` in JS via getUnavailableEquipment ...
  if (unavailable.length > 0) {
    return { success: false, error: `...unavailable...` }
  }
}
// ... booking insert happens later in the same function, as a separate statement
```

`supabase/migrations/20260020000000_equipment_quantity.sql` documents this
gap directly: `booking_equipment` has no natural per-unit identity to
constrain at the DB level the way `bookings_no_overlap` does for room/time
overlap (a Postgres exclusion constraint). Time-slot overlap has a real DB
backstop; equipment quantity does not.

**Impact**: two concurrent booking requests for the last available unit of
some equipment (e.g. the studio's only bass amp) can both read "1 available,
0 in use", both pass `getUnavailableEquipment`, and both insert successfully
— the studio ends up double-booked for physical gear with no server-side
guard. This requires actual concurrency (two near-simultaneous requests) to
trigger, so it won't show up in manual single-user testing.

Verify before starting: read `src/lib/equipmentAvailability.ts` (the
`getUnavailableEquipment` function) to confirm it does pure in-memory
overlap counting with no DB-level locking, and confirm `createBooking.ts`
does the equipment check and the final `bookings` insert as two separate
`await supabase...` calls with no surrounding transaction/lock.

## Fix

Two viable approaches — pick based on what's simplest to verify against the
existing `bookings_no_overlap` pattern already proven in this codebase:

**Option A (preferred — matches existing pattern): DB-level serialization.**
Wrap the equipment check + the `booking_equipment` insert rows in a single
Postgres function (RPC) called via `supabase.rpc(...)`, using
`SELECT ... FOR UPDATE` on the relevant `equipment` rows (or an advisory
lock keyed on equipment_id) to serialize concurrent checks for the same
equipment_id. The booking row itself can still be inserted from the
existing JS flow, but the equipment-availability check + reservation must
happen inside one locked transaction so a second concurrent request sees the
first request's reservation before deciding availability.

**Option B (simpler, more conservative): optimistic re-check-after-insert.**
Insert `booking_equipment` rows unconditionally alongside the booking, then
run a single aggregate query per equipment_id (`count of overlapping,
non-cancelled bookings using this equipment_id in this time range`) and if
it exceeds `quantity`, roll back (delete the just-inserted booking +
booking_equipment rows, or mark it cancelled) and return the existing
"unavailable" error to the user. This trades a rare wasted insert+rollback
for not needing a new Postgres function.

Choose Option A if you're comfortable writing/testing a Postgres function;
otherwise Option B, clearly commented as a deliberate optimistic-then-verify
tradeoff (matching this codebase's existing preference for explicit comments
on non-obvious concurrency decisions, e.g. the migration comment already
there).

Do not attempt to add a DB exclusion constraint directly on
`booking_equipment` analogous to `bookings_no_overlap` unless you've
confirmed Postgres exclusion constraints support the quantity>1 case
(counting concurrent overlaps up to N) — they don't natively; that's
exactly why the migration comment says a natural constraint doesn't exist.

## Files in scope

- `src/lib/actions/createBooking.ts` (equipment check + insert flow)
- `src/lib/equipmentAvailability.ts` (if the overlap logic needs to move
  into a Postgres function, keep this file's pure logic as the JS-side
  fallback/tests source of truth, don't delete it)
- A new migration file if Option A (new RPC function) — do NOT edit
  `supabase/migrations/20260020000000_equipment_quantity.sql` in place;
  add a new dated migration.

## Files explicitly out of scope

- Room/time-slot overlap logic (`bookings_no_overlap` constraint) — already
  correct, don't touch.
- Equipment admin CRUD (`src/lib/actions/admin/equipment.ts`) — unrelated.

## Verification

1. `npm run typecheck` and existing test suite (`npm run test:run`) pass.
2. Existing unit tests for `getUnavailableEquipment`
   (`src/lib/__tests__/equipmentAvailability.test.ts` or similar — locate via
   the actual test file name) still pass unmodified if you kept the pure
   function; update them only if the function's contract changed.
3. Write a new integration-style test (or manual concurrency test if the
   integration test setup doesn't support it — check
   `vitest.integration.config.mts` first) that fires two concurrent
   `createBooking` calls for the same single-quantity equipment item and the
   same overlapping time window, and asserts exactly one succeeds.
4. Manual smoke test: create a booking with equipment via the UI, confirm
   normal (non-concurrent) booking still works and still rejects an
   obviously-conflicting second booking as before.

## Done criteria

- Two concurrent requests for the last unit of an equipment item cannot both
  succeed — verified by the new concurrency test.
- Existing single-request equipment conflict rejection still works
  unchanged.
- `npm run typecheck && npm run test:run` green.

## Maintenance note

If equipment gets its own dedicated booking/reservation table in the future
(separating "reserved" from "booking record"), revisit this fix — the
locking strategy chosen here is scoped to the current
`booking_equipment` join-table shape.
