# 027 — Single-pass dashboard stat aggregation

Planned at commit: `02be9c6`. Depends on 020 (parallel queries) landing
first for a clean diff, but is independently correct either order.

## Priority / Effort

P3 (perf, no ceiling currently but no cap either) / S

## Problem

`src/app/admin/dashboard/page.tsx:71-137` computes 8+ separate stats via
independent `.filter()`/`.reduce()` passes over the same `data` array
(collected, outstanding, projected, bySource ×3, counts ×5, bookedHours),
plus two unfiltered `select()` queries (current + previous period, lines
47-65) with no `.limit()`. For a busy studio with a wide date range ("Last
30 days" or a full year), this pulls every matching row's full columns
client-side with no cap, then re-scans the array 8+ times instead of
computing all stats in one pass.

Not urgent at current data volume (not measured, but this is a
single-studio app) — this is a "no ceiling" finding, not an active
incident. Treat accordingly: don't over-invest.

## Fix

1. **Single-pass aggregation**: replace the 8 separate `.filter().reduce()`
   calls with one `.reduce()` that accumulates all stats in a single loop
   over `data`. This is a mechanical transform — same output values, same
   input, just one iteration instead of eight. Write it as a plain object
   accumulator, e.g.:

   ```ts
   const stats = data.reduce((acc, b) => {
     const isRevenue = b.status === 'confirmed' || b.status === 'completed'
     if (isRevenue) acc.collected += Number(b.amount_paid)
     if (b.status === 'confirmed' && Number(b.amount_paid) < Number(b.deposit_amount)) {
       acc.outstanding += Number(b.deposit_amount) - Number(b.amount_paid)
     }
     // ... etc for projected, bySource, counts, bookedHours
     return acc
   }, { collected: 0, outstanding: 0, /* ... initial shape ... */ })
   ```

   Read the current full reduce logic (lines 71-137) carefully before
   rewriting — every existing filter condition must be preserved exactly,
   this is a refactor, not a reimplementation. Get the output identical.

2. **Query cap**: add a sane `.limit()` to both booking queries (current and
   previous period) as a defensive ceiling — pick a number well above any
   realistic single-studio monthly booking count (e.g. 5000) purely as a
   runaway-query guard, not as a real pagination mechanism. If the studio
   ever legitimately exceeds that in one query window, the fix at that point
   is a proper Postgres aggregate RPC, not raising this number — leave a
   comment saying so.

## Files in scope

- `src/app/admin/dashboard/page.tsx` only.

## Files explicitly out of scope

- Don't move aggregation to a Postgres RPC/view in this plan — that's a
  larger change or a different query strategy than the JS-side reduce
  approach. If you get partway through and realize the single-pass JS
  reduce is genuinely hard to keep correct (many interacting conditions),
  STOP and report back rather than half-migrating to SQL.

## Verification

1. `npm run typecheck` passes.
2. Manual test: load `/admin/dashboard` with real data across a few
   different date ranges (this month, last 7 days, last 30 days) and
   confirm every displayed stat (collected, outstanding, projected,
   bySource counts, booking counts, utilization%, booked/available hours,
   period-over-period delta) is byte-for-byte identical to before the
   change. This is the critical check — a subtle reduce-logic bug here
   silently reports wrong money figures to the studio owner.
3. If any dashboard-page tests exist (check after plan 019's coverage work,
   if it landed), run them.

## Done criteria

- All 8 stats computed in a single `.reduce()` pass over `data`.
- `.limit()` added to both booking queries as a defensive cap.
- Verified identical output across multiple real date ranges.
- `npm run typecheck` passes.

## Maintenance note

If a new stat is added to the dashboard in the future, add it to the single
accumulator object rather than reintroducing a separate `.filter().reduce()`
pass — that's exactly the drift this plan is fixing.
