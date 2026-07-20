# 021 — Add date-range filter to equipment usage query

Planned at commit: `02be9c6`.

## Priority / Effort

P3 (perf, grows with booking volume, not urgent yet) / S

## Problem

`src/lib/actions/createBooking.ts:109-116`:

```ts
const { data: usageRows, error: usageError } = await supabase
  .from('booking_equipment')
  .select('equipment_id, bookings!inner(status, start_at, end_at)')
  .in('equipment_id', selectedEquipment.map(item => item.id))
  .neq('bookings.status', 'cancelled')
```

This pulls every non-cancelled booking ever made for the requested equipment
IDs — no `start_at`/`end_at` bound — then filters for time-window overlap in
JS via `getUnavailableEquipment`. Query cost grows linearly with an
equipment item's total historical booking count, not with bookings actually
near the requested date. Fine today at low volume; becomes the first
bottleneck on the booking-creation path as history accumulates.

## Fix

Add a coarse date filter to the query — wide enough that it can't exclude a
real overlap, but narrow enough to cut historical noise. A safe bound: only
rows where `bookings.end_at >= <requested start_at minus some buffer>` and
`bookings.start_at <= <requested end_at plus some buffer>` — actually, since
overlap requires `existing.start_at < requested.end_at AND existing.end_at >
requested.start_at`, the *exact* (not just coarse) bound is:

```ts
.gte('bookings.end_at', start_at)   // existing booking ends at/after our start
.lte('bookings.start_at', end_at)   // existing booking starts at/before our end
```

Add these two filters to the existing query chain. Verify PostgREST supports
filtering on a joined (`bookings!inner`) table's columns with `.gte`/`.lte`
using the `bookings.column` dot-notation the codebase already uses for
`.neq('bookings.status', ...)` on the same query — it should, since that
pattern is already proven one line above.

Keep the JS-side `getUnavailableEquipment` overlap logic unchanged — this is
a narrowing filter (removes only rows that can't possibly overlap), not a
replacement for it. Do not attempt to move the overlap logic entirely into
the SQL query; the existing pure function is tested (per finding 019's
audit) and correctness-proven, don't risk that.

## Files in scope

- `src/lib/actions/createBooking.ts` — the query at lines 109-116 only.

## Files explicitly out of scope

- `src/lib/equipmentAvailability.ts` — don't touch the pure overlap
  function.
- Plan 016's transaction/locking fix — this plan is orthogonal (perf, not
  correctness) and can land independently in either order.

## Verification

1. `npm run typecheck` passes.
2. Existing equipment-conflict tests (from `equipmentAvailability.test.ts` /
   any new ones from plan 019) still pass — the filter must not exclude any
   row that a correct overlap check would have included.
3. Manual test: create two bookings for the same equipment with genuinely
   overlapping times, confirm the second is still rejected as unavailable
   (same behavior as before the filter).
4. Manual test: create a booking for equipment that has old, unrelated
   historical bookings (dates far in the past) — confirm those don't affect
   the new booking's availability check (should already be true, this just
   confirms the filter doesn't break anything).

## Done criteria

- Query includes the date-range narrowing filter.
- Overlap-rejection behavior is unchanged (verified by existing + manual
  tests).
- `npm run typecheck` passes.

## Maintenance note

If `getUnavailableEquipment`'s overlap semantics ever change (e.g. buffer
time added between bookings), revisit this filter's bounds — it must stay a
superset of what the JS logic considers a possible overlap.
