# 020 — Parallelize dashboard's sequential Supabase queries

Planned at commit: `02be9c6`.

## Priority / Effort

P3 (perf, small but free win) / S

## Problem

`src/app/admin/dashboard/page.tsx:47-65` awaits three independent queries
one after another:

```ts
const { data: bookings } = await supabase.from('bookings').select(...)...
const { data: settings } = await supabase.from('settings').select(...)...
const { data: prevBookings } = await supabase.from('bookings').select(...)...
```

None of these three queries depend on each other's results (`prevBookings`
depends on `from`/`to` computed earlier in the function via
`getPreviousPeriod`, but not on `bookings` or `settings`). Sequential
`await`s here cost roughly 2 extra full round-trips of added latency per
dashboard page load.

Contrast with `src/app/admin/settings/page.tsx:26-39`, which already
correctly parallelizes its 4 independent queries via `Promise.all` — that's
the pattern to copy.

## Fix

In `src/app/admin/dashboard/page.tsx`, replace the three sequential awaits
with:

```ts
const [{ data: bookings }, { data: settings }, { data: prevBookings }] = await Promise.all([
  supabase
    .from('bookings')
    .select('amount_paid, deposit_amount, total_amount, status, source, start_at, end_at')
    .gte('start_at', `${from}T00:00:00+08:00`)
    .lte('start_at', `${to}T23:59:59+08:00`),
  supabase
    .from('settings')
    .select('operating_open, operating_close')
    .single(),
  supabase
    .from('bookings')
    .select('amount_paid, status')
    .gte('start_at', `${prevFrom}T00:00:00+08:00`)
    .lte('start_at', `${prevTo}T23:59:59+08:00`),
])
```

Note: `prevFrom`/`prevTo` (from `getPreviousPeriod(from, to)`) must be
computed *before* this `Promise.all` block since the third query needs them
— check the current code's ordering and move the `getPreviousPeriod` call
above the `Promise.all` if it currently sits between the first and third
query.

## Files in scope

- `src/app/admin/dashboard/page.tsx` only.

## Files explicitly out of scope

- Don't touch the aggregation/reduce logic below the queries (that's
  finding 12 / a separate, lower-priority plan) — this plan is scoped to
  the fetch parallelization only.

## Verification

1. `npm run typecheck` passes.
2. Manual check: load `/admin/dashboard` with a date range that has data,
   confirm all stats (revenue, utilization, source breakdown, counts, and
   the period-over-period delta) render identically to before the change —
   this is a pure latency optimization, values must not change.
3. If `dashboardPeriod.test.ts` or similar exists and covers this page
   (unlikely, since page-level tests probably don't exist per finding 4/019
   — confirm), run it; otherwise this is verified by the manual check only.

## Done criteria

- Three queries fire concurrently via `Promise.all`, not sequentially.
- Dashboard renders identical output to before the change.
- `npm run typecheck` passes.

## Maintenance note

None — this is a self-contained, low-risk perf fix.
