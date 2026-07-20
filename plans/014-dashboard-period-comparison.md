# Plan 014: Add period-over-period comparison to the admin dashboard

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7879781..HEAD -- src/app/admin/dashboard/page.tsx`
> If the file changed since this plan was written, compare against the
> excerpt below before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3 (direction)
- **Effort**: S — the aggregates are already computed, this adds a second fetch + delta display
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `7879781`, 2026-07-13

## Why this matters

`src/app/admin/dashboard/page.tsx` already computes `collected`, `outstanding`, `projected`, `utilization`, `bySource`, and `counts` for a selected date range, with quick-links for "This month / Last 7 / Last 30." What it doesn't show is any comparison to the prior period — the owner can see "₱X collected this month" but not "up or down vs. last month." This is a natural, low-cost next iteration of a feature that's already ~80% built: the aggregation logic exists, this plan just runs it twice (current range + the equivalent prior range) and shows a delta. A charting library / time-series breakdown is explicitly NOT what this plan does — that's a larger, separate feature; this is the cheapest version that delivers the most immediately useful signal ("trending up or down").

## Current state

- `src/app/admin/dashboard/page.tsx` — full file read during audit (at least first 140 lines; read the rest before starting, the file likely continues past line 140 with the render/JSX). Key structure:
  ```tsx
  export default async function DashboardPage({ searchParams }: PageProps) {
    const params = await searchParams
    const now = new Date()
    const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
    const from = params.from ?? defaultFrom
    const to = params.to ?? defaultTo

    const supabase = await createClient()
    const { data: bookings } = await supabase
      .from('bookings')
      .select('amount_paid, deposit_amount, total_amount, status, source, start_at, end_at')
      .gte('start_at', `${from}T00:00:00+08:00`)
      .lte('start_at', `${to}T23:59:59+08:00`)
    const { data: settings } = await supabase.from('settings').select('operating_open, operating_close').single()
    const data = bookings ?? []
    // ... collected/outstanding/projected/bySource/counts/utilization all computed from `data` here
  ```
- `src/components/admin/StatCard.tsx` — the component rendering each stat tile; read this to see its current props shape before adding a delta indicator to it (likely needs an optional `previousValue` or `deltaPct` prop added).
- All money arithmetic in this file is already integer centavos, no floats (confirmed by reading lines 60-75) — any new comparison math must follow the same convention (percentage deltas can use floating math for DISPLAY only, e.g. `Math.round()`, but never let a float leak into a stored/compared money value).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Lint      | `pnpm lint`               | exit 0              |

## Scope

**In scope**:
- `src/app/admin/dashboard/page.tsx` — compute the equivalent prior period (same length, immediately preceding the current `from`/`to` range) and fetch/aggregate its `collected`/`counts` the same way.
- `src/components/admin/StatCard.tsx` — add an optional delta indicator (e.g. "+12% vs. last period" / "-5% vs. last period", with a simple color cue) to the existing tile.

**Out of scope**:
- Any charting library or time-series/day-by-day breakdown — explicitly deferred, this plan is the cheap delta-only version.
- The `utilization` metric's day-of-week breakdown mentioned in the original audit finding — that's a separate, larger feature (would need a new visualization, not just a delta); not in scope here.
- Any change to how `bookings`/`settings` are fetched beyond adding the second (prior-period) query.

## Git workflow

- Branch: `advisor/014-dashboard-period-comparison`
- Commit per step; message style matches `git log`
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Read the full dashboard page and `StatCard` component

Read `src/app/admin/dashboard/page.tsx` past line 140 (the render/JSX section wasn't seen during audit) and `src/components/admin/StatCard.tsx` in full, to know exactly how stats are currently rendered before adding a delta prop.

**Verify**: no command — research step.

### Step 2: Compute the equivalent prior period's range

Add logic to derive a `prevFrom`/`prevTo` pair: same number of days as `from`..`to`, ending the day before `from`. E.g. if `from`/`to` is a 30-day range, `prevTo` = `from` minus 1 day, `prevFrom` = `prevTo` minus 29 days.

```ts
const rangeDays = Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1
const prevToDate = new Date(from)
prevToDate.setDate(prevToDate.getDate() - 1)
const prevFromDate = new Date(prevToDate)
prevFromDate.setDate(prevFromDate.getDate() - (rangeDays - 1))
const prevFrom = prevFromDate.toISOString().split('T')[0]
const prevTo = prevToDate.toISOString().split('T')[0]
```

**Verify**: `npx tsc --noEmit` → exit 0 (this snippet alone should typecheck cleanly; sanity-check manually for a known range, e.g. `from=2026-07-01, to=2026-07-31` → `prevFrom=2026-06-01, prevTo=2026-06-30`).

### Step 3: Fetch and aggregate the prior period the same way as the current one

Add a second `bookings` query scoped to `prevFrom`/`prevTo`, and compute at minimum `collected` for that period (extend to `counts.total` too if straightforward, following the exact same reduce logic already used for the current period — do not introduce a different aggregation approach, copy the pattern).

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 4: Add a delta prop to `StatCard` and wire it in for `collected`

Extend `StatCard`'s props with an optional `previousValue?: number` (or `deltaPct?: number`, whichever fits its existing prop shape better per Step 1's read), compute the percentage change (`((current - previous) / previous) * 100`, guarding against division by zero when `previous === 0`), and render it as a small "+X% vs. last period" / "-X% vs. last period" label with a color cue (e.g. green for positive revenue change, red/muted for negative — match this repo's existing color tokens from `tailwind.config.ts`, don't introduce new colors).

**Verify**: `npx tsc --noEmit` → exit 0. Manually: `pnpm dev`, visit `/admin/dashboard`, confirm the "Collected" stat tile shows a delta vs. the prior equivalent period, and that switching between "This month"/"Last 7"/"Last 30" quick links updates the comparison correctly (each should compare against ITS OWN equivalent-length prior period, not always "last month").

## Test plan

The `rangeDays`/`prevFrom`/`prevTo` computation in Step 2 is pure date math — add a unit test for it (extract it into a small testable function if it isn't already, e.g. `src/lib/dashboardPeriod.ts` with a `getPreviousPeriod(from, to)` export, following this repo's pattern of extracting pure logic out of Server Components for testability — see `src/lib/slotSelection.ts` as the precedent for "pure logic lives in `src/lib/`, page component just calls it"). Cover: a 30-day range, a 7-day range, a single-day range, and a range crossing a month boundary (e.g. `from=2026-02-01` needs `prevTo=2026-01-31` — verifies no off-by-one at month boundaries). Verification: `pnpm test:run` → all pass including new cases.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:run` exits 0, including new period-math tests
- [ ] `grep -n "previousValue\|deltaPct" src/components/admin/StatCard.tsx` shows the new prop
- [ ] No files outside the in-scope list are modified (`git status`) — note the new `src/lib/dashboardPeriod.ts` (or similar) file is expected and in-scope
- [ ] `plans/README.md` status row updated
- [ ] Manual verification in Step 4 completed and confirmed working across all three quick-link ranges

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the location in "Current state" doesn't match the excerpt (drift since this plan was written) — re-read the full file fresh, especially the JSX/render section not seen during planning.
- `StatCard.tsx`'s existing prop shape makes a delta indicator awkward to bolt on (e.g. it's tightly coupled to a single-value display with no room for a secondary label) — if so, propose the minimal structural change needed rather than forcing an ugly fit, and note it in your report.
- The month-boundary date math in Step 2 produces an off-by-one in testing — this is exactly the kind of Asia/Manila-adjacent date bug this codebase has had before (per `HANDOFF.md`'s note); don't ship it if the test in "Test plan" doesn't pass cleanly for the month-boundary case.

## Maintenance notes

- If the studio owner later wants day-of-week or time-series breakdowns (the larger feature this plan deliberately deferred), that's a separate plan requiring a charting decision — this plan's delta-only approach doesn't block that future work, it's additive.
- A reviewer should manually check the month-boundary case in the browser (not just trust the unit test) given this codebase's documented history of Asia/Manila timezone bugs.
