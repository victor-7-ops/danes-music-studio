# 019 — Test coverage for money-moving server actions

Planned at commit: `02be9c6`. Supersedes/absorbs the still-open scope of
plan 005 ("Money-actions test coverage") — read `plans/005-money-actions-test-coverage.md`
first; if this plan and 005 overlap, treat 005 as the primary spec and this
plan as an update expanding its target list to include the equipment
conflict-check path (which didn't exist when 005 was written). If 005 is
still TODO, do not run both — pick one (recommend this one, it's more
current) and mark the other REJECTED with a one-line pointer here.

## Priority / Effort

P1 (no DB-mutating money path has test coverage; CI exists but isn't
actually gating the riskiest code) / L

## Problem

None of the following server actions have any test coverage, confirmed by
absence of matching files under `src/lib/actions/**/__tests__/` or
`*.test.ts` next to them (only pure helper functions like
`getUnavailableEquipment`, `dashboardPeriod`, `slotSelection` have tests):

- `src/lib/actions/admin/confirmDeposit.ts` — writes `amount_paid`, flips
  status to `confirmed`, triggers email + Telegram + GCal push.
- `src/lib/actions/admin/cancelBooking.ts` — cancels a booking, presumably
  triggers refund/notification logic (read it to confirm).
- `src/lib/actions/admin/equipment.ts` — create/update/delete equipment,
  quantity validation.
- `src/lib/actions/createBooking.ts` — the main booking-creation path,
  including the equipment conflict-check integration (lines 105-144) and the
  `bookings!inner` join / array-unwrap logic at line 122-129, which is
  exactly the kind of Supabase query-shape code that silently breaks on a
  schema or PostgREST behavior change with no test to catch it.

CI (added in plan 004) runs `npm run test:run` on push/PR, but since none of
these files have tests, CI currently provides zero protection against
regressions in the app's actual money-mutating logic — only the pure helper
functions are protected.

## Fix

This is a coverage-building plan, not a single fix. Approach:

1. **Establish the test-double strategy first, before writing any test
   cases.** These are server actions that call `createClient()` from
   `@/lib/supabase/server` internally — they are not pure functions with
   injected dependencies. Read `vitest.config.mts` and
   `vitest.integration.config.mts` to determine what test infrastructure
   already exists (a mock Supabase client? a local Supabase test instance?
   nothing yet?). If nothing exists:
   - Prefer the `vitest.integration.config.mts` path against a real local
     Supabase instance (via `supabase start`, check if this repo already has
     Supabase CLI config for that — look for `supabase/config.toml`) if
     that's feasible without new infra work.
   - If a local Supabase instance isn't practical here, mock
     `@/lib/supabase/server`'s `createClient()` at the module level with
     `vi.mock`, building a minimal fluent mock (`.from().select().eq()...`)
     — check if a shared mock helper already exists anywhere in the repo
     before writing a new one from scratch.
   - **STOP and report back if establishing this test seam requires
     refactoring the actions to accept an injected Supabase client** — that
     would be a larger architectural change than this plan's effort budget
     assumes; don't improvise a DI refactor, flag it as a needed follow-up
     plan instead.

2. Write tests in priority order (stop and ship after each if you're running
   low on budget — partial coverage landed is better than none):
   - `createBooking.ts` — happy path, equipment-conflict rejection path,
     overlap-constraint rejection path (the DB exclusion constraint error
     surfaced as a normal `error.message` — check how that's currently
     handled).
   - `confirmDeposit.ts` — happy path, invalid amount (once plan 017 lands,
     covers the integer check too), already-cancelled booking rejection
     (the `.neq('status', 'cancelled')` guard).
   - `cancelBooking.ts` — happy path, whatever side effects it has.
   - `equipment.ts` — create/update/delete, quantity validation boundary
     (0, negative, non-integer).

## Files in scope

- New test files only, under whatever location convention you establish in
  step 1 (match this repo's existing convention if one exists for the
  `*.test.ts` files that do exist — check where
  `equipmentAvailability.test.ts` lives and mirror that).
- Do not modify the action files themselves unless step 1 forces a minimal,
  clearly-flagged seam change (and if so, treat that as the smallest
  possible diff — e.g. an optional injected-client parameter defaulting to
  the real `createClient()`).

## Files explicitly out of scope

- Don't refactor action logic "while you're in there." This plan is
  additive test coverage only.
- Don't write tests for the pure helpers that already have them
  (`equipmentAvailability`, `dashboardPeriod`, `slotSelection`,
  `bookings` overlap logic) — redundant.

## Verification

1. `npm run test:run` (or `npm run test:integration` if you went the local-
   Supabase route) passes locally.
2. Confirm the new tests actually exercise the DB-mutating code path, not
   just validation short-circuits — e.g. a `confirmDeposit` happy-path test
   must assert `amount_paid` and `status` actually changed, not just that no
   error was thrown.
3. Confirm CI (`.github/workflows/ci.yml`) picks up and runs the new test
   files (it should, if they match the existing `test:run`/`test:integration`
   glob — verify by checking the workflow file's test step).

## Done criteria

- At minimum, `createBooking.ts`'s equipment-conflict and overlap-rejection
  paths have passing tests (this directly de-risks plan 016's fix).
- `confirmDeposit.ts` happy path + rejection paths tested.
- CI green with new tests included.
- If full coverage of all four files isn't reached in one pass, update this
  plan's status to IN PROGRESS with a note on what's covered vs. remaining,
  rather than marking DONE prematurely.

## Maintenance note

Whatever test-double strategy gets established here (mock vs. local
Supabase instance) becomes the pattern for all future server-action tests —
document the choice briefly in a comment at the top of the first test file
so the next contributor doesn't reinvent it.
