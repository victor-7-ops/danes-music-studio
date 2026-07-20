# Plan 002: Scope unbounded booking queries to a date range in `/api/availability` and admin calendar

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7879781..HEAD -- src/app/api/availability/route.ts src/app/admin/calendar/page.tsx`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `7879781`, 2026-07-13

## Why this matters

`/api/availability` is the highest-traffic customer-facing endpoint (hit on every visit to `/book/slots`) and it queries `bookings` with no date bound — it pulls every `confirmed`/`pending` booking the studio has ever taken, for every single day-availability check. The admin calendar page does the same for its own render. Both queries grow linearly with the studio's total booking history, so latency degrades every month the business operates, independent of traffic volume. The sibling `blocked_slots` query in the same file already shows the correct scoped pattern — this plan copies it.

## Current state

- `src/app/api/availability/route.ts:16-40` — full `Promise.all` block. The `bookings` query (lines 19-22) has no date filter:
  ```ts
  const [bookingsRes, blockedRes, specialRes, settingsRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('start_at, end_at, status, hold_expires_at')
      .in('status', ['confirmed', 'pending']),

    supabase
      .from('blocked_slots')
      .select('start_at, end_at')
      .gte('end_at', `${date}T00:00:00+08:00`)
      .lte('start_at', `${date}T23:59:59+08:00`),
    ...
  ```
  The `blocked_slots` query above shows the exact pattern to copy: `.gte('end_at', ...).lte('start_at', ...)` bounding a single day in Asia/Manila (`+08:00` literal offset, matching this repo's existing convention — see `HANDOFF.md`'s timezone note).
- `src/app/admin/calendar/page.tsx:4-14` — full page component. The query has no date filter at all, only a status filter:
  ```ts
  const { data: bookings } = await supabase
    .from('bookings')
    .select(
      'id, confirmation_code, band_name, customer_name, customer_phone, customer_email, start_at, end_at, status, deposit_amount, amount_paid, total_amount, source, payment_proof_url, booking_equipment(price_at_booking, equipment(name))'
    )
    .neq('status', 'cancelled')
    .order('start_at')
  ```
  This page renders into `BookingsCalendar` (`src/components/admin/BookingsCalendar.tsx`), a `react-big-calendar` client component. It currently has no month/range navigation wired to a server refetch — it loads everything once.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Lint      | `pnpm lint`               | exit 0              |
| Tests     | `pnpm test:run`           | all pass            |

## Scope

**In scope**:
- `src/app/api/availability/route.ts` — bound the `bookings` query to the requested date.
- `src/app/admin/calendar/page.tsx` — bound the query to a range, driven by a `from`/`to` search param following the same pattern as `src/app/admin/dashboard/page.tsx` (already uses `searchParams: Promise<{ from?: string; to?: string }>` with sane month defaults).
- `src/components/admin/BookingsCalendar.tsx` — only if needed to wire month navigation to a URL param change (read it first; if it already supports an `onNavigate`/`onRangeChange` callback prop pattern, use it — otherwise add a minimal one).

**Out of scope**:
- `src/lib/availability.ts` (`getAvailableSlots` logic itself) — unchanged, only its callers' data-fetch scope changes.
- `src/app/admin/dashboard/page.tsx` — already correctly scoped, used here only as the pattern reference.
- Any change to the `bookings` table schema or indexes.

## Git workflow

- Branch: `advisor/002-scope-booking-queries`
- Commit per step; message style matches `git log` (e.g. `fix: scope availability and calendar queries to a date range`)
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Scope `/api/availability`'s `bookings` query to the requested date

In `src/app/api/availability/route.ts`, change the `bookings` query to match the `blocked_slots` pattern immediately below it:

```ts
supabase
  .from('bookings')
  .select('start_at, end_at, status, hold_expires_at')
  .in('status', ['confirmed', 'pending'])
  .gte('end_at', `${date}T00:00:00+08:00`)
  .lte('start_at', `${date}T23:59:59+08:00`),
```

This is the exact bound already used one query below for `blocked_slots` — the `date` variable is already validated by `DATE_RE` earlier in the file (line 12), so no new validation is needed.

**Verify**: `npx tsc --noEmit` → exit 0. Then manually: `pnpm dev`, visit `/book/slots?date=<any future date>&service=rehearsal` (check `src/app/book/slots/page.tsx` for the exact param name it uses), confirm slots still render correctly and match what they showed before the change (compare against a booking you know exists on/near that date, or an empty day showing all slots open).

### Step 2: Read `BookingsCalendar.tsx` to check for existing range-navigation support

Read `src/components/admin/BookingsCalendar.tsx` in full. Check whether it already exposes an `onNavigate` or `onRangeChange` prop from `react-big-calendar` that the page could hook into. Report what you find before proceeding — if it already has a range callback wired to nothing, use it; if it has no such hook, add the minimal `onRangeChange` handler that updates the URL's `from`/`to` search params (use `next/navigation`'s `useRouter().push`).

### Step 3: Scope the admin calendar page's query to a `from`/`to` range

In `src/app/admin/calendar/page.tsx`, change the component to accept `searchParams` the same way `src/app/admin/dashboard/page.tsx` does (read that file's lines 26-41 as the exact pattern to match — default to current month if no params given), and bound the `bookings` query:

```ts
interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const params = await searchParams
  const now = new Date()
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  const from = params.from ?? defaultFrom
  const to = params.to ?? defaultTo

  const supabase = await createClient()

  const { data: bookings } = await supabase
    .from('bookings')
    .select(
      'id, confirmation_code, band_name, customer_name, customer_phone, customer_email, start_at, end_at, status, deposit_amount, amount_paid, total_amount, source, payment_proof_url, booking_equipment(price_at_booking, equipment(name))'
    )
    .neq('status', 'cancelled')
    .gte('end_at', `${from}T00:00:00+08:00`)
    .lte('start_at', `${to}T23:59:59+08:00`)
    .order('start_at')
  // ... rest unchanged
```

Wire the `onRangeChange`/`onNavigate` handler found (or added) in Step 2 to update the URL's `from`/`to` params so calendar month navigation triggers a new server fetch. If Step 2 found this is non-trivial (e.g. `react-big-calendar`'s range shape doesn't map cleanly to `from`/`to` strings), implement the simplest version: convert the range's `start`/`end` Date objects to `YYYY-MM-DD` strings and push to the URL.

**Verify**: `npx tsc --noEmit` → exit 0. Manually: `pnpm dev`, log in to `/admin`, visit `/admin/calendar`, confirm current month's bookings render, then navigate to next/previous month in the calendar UI and confirm the URL updates and different bookings load (test against a booking you create via `/admin/walk-in` dated in a different month, or by manually visiting `/admin/calendar?from=2026-01-01&to=2026-01-31`).

## Test plan

No existing test file covers `/api/availability`'s route handler directly (only `src/lib/__tests__/availability.test.ts` exists, testing `getAvailableSlots` in isolation — confirm this by reading that file; if it only tests the pure function and not the route, no changes needed there since this plan doesn't touch `getAvailableSlots`). No test coverage exists for `admin/calendar/page.tsx` (it's a Server Component with no test file — confirmed via file listing). This plan doesn't add new tests; verification is manual (see Steps 1 and 3 above) because both changes are data-fetch scoping with no new business logic to unit test.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:run` exits 0 (no regressions — confirms `getAvailableSlots` tests still pass since that function is untouched)
- [ ] `grep -n "gte('end_at'" src/app/api/availability/route.ts` shows the new bound on the `bookings` query
- [ ] `grep -n "searchParams" src/app/admin/calendar/page.tsx` shows the new range param handling
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated
- [ ] Manual verification in Steps 1 and 3 completed and confirmed working

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts (drift since this plan was written).
- A booking that spans midnight (unlikely given 9AM-10PM operating hours, but check) is excluded by the new date bound — if you find any booking logic elsewhere that allows overnight-spanning bookings, widen the bound with padding (e.g. `T00:00:00+08:00` minus a few hours) and note it in Maintenance notes instead of silently narrowing correctness.
- `BookingsCalendar.tsx` has no clean way to surface a range-change event without a larger refactor — in that case, implement Step 3's query scoping only (keep the "load current month by default" behavior) and report that live range navigation was deferred, rather than forcing an awkward integration.

## Maintenance notes

- If a future feature allows bookings that span past midnight or across days, the date-bound queries added here (both in `/api/availability` and admin calendar) need re-checking — they currently assume same-day start/end.
- A reviewer should confirm the admin calendar's default month-view still shows all of "this month's" bookings after the change, not an off-by-one due to timezone boundary math.
- If `react-big-calendar`'s range navigation UX feels laggy after this change (server round-trip per month nav), consider client-side caching of adjacent months — deferred, not needed at current data volume.
