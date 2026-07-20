# Plan 005: Add unit test coverage for money-handling server actions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7879781..HEAD -- src/lib/actions/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: LOW to add; MED if writing tests surfaces a real bug requiring a behavior fix (if so, STOP per the conditions below rather than silently changing behavior)
- **Depends on**: plans/004-ci-pipeline.md (not a hard blocker, but land 004 first so these new tests are enforced by CI immediately)
- **Category**: tests
- **Planned at**: commit `7879781`, 2026-07-13

## Why this matters

None of the 12 files in `src/lib/actions/` and `src/lib/actions/admin/` have any test coverage — these are exactly the money-handling, auth-gated, data-mutating code paths (deposit confirmation, walk-in booking creation, cancellation, equipment pricing) that the project's own conventions (integer centavos, server-side price computation) exist to protect. A regression here means a wrong charge or a double-booking, not a cosmetic bug. This plan starts with the two highest-financial-risk actions — `confirmDeposit` and `cancelBooking` — as characterization tests, establishing the mocking pattern for the rest to follow in later work.

## Current state

- `src/lib/actions/admin/createWalkIn.ts` — already read in full during the audit (107 lines). Uses `createClient()` from `@/lib/supabase/server`, checks `auth.getUser()`, validates date/time params, checks overlap, looks up `service_types` rate, computes `total_amount`/`deposit_amount` in integer centavos, inserts a `bookings` row with `status: 'completed'`.
- No test doubles or mocking helpers currently exist for the Supabase server client anywhere in the repo (confirmed: no `__mocks__` directory, no `vi.mock('@/lib/supabase/server')` pattern found via grep). This plan must establish that pattern.
- Existing test pattern to follow: `src/lib/__tests__/slotSelection.test.ts` — pure-function unit tests with `describe`/`it`/`expect` from `vitest`, no mocking needed (tests a pure function). This plan's targets are NOT pure functions (they call Supabase), so a different pattern is needed — read `src/lib/__tests__/bookings.test.ts` (the one file excluded from the default `vitest.config.mts` via `exclude: ['**/bookings.test.ts', ...]` and instead run under `vitest.integration.config.mts`) to see how this repo handles Supabase-touching tests: it hits a REAL Supabase instance using `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`, not a mock. Read that file in full before starting Step 1 — it is the closest existing precedent in this codebase and this plan should follow the same integration-test-against-real-Supabase approach rather than introducing a new mocking library, to stay consistent with repo conventions.
- `vitest.integration.config.mts` currently only includes `src/lib/__tests__/bookings.test.ts` explicitly (`include: ['src/lib/__tests__/bookings.test.ts']`) — this plan needs to widen that include list to add the new test files.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Unit tests | `pnpm test:run`          | all pass            |
| Integration tests | `pnpm test:integration` | all pass — requires `.env.local` with `SUPABASE_SERVICE_ROLE_KEY` set to a real (ideally local/dev, not production) Supabase project |

## Scope

**In scope**:
- New file: `src/lib/__tests__/confirmDeposit.test.ts`
- New file: `src/lib/__tests__/cancelBooking.test.ts`
- `vitest.integration.config.mts` — widen the `include` array to add the two new files.

**Out of scope**:
- The other 10 files in `src/lib/actions/` (`createBooking.ts`, `createWalkIn.ts`, `createOnsite.ts`, `equipment.ts`, `updateSettings.ts`, `upsertSpecialHours.ts`, `connectGoogleCalendar.ts`, `disconnectGoogleCalendar.ts`, `syncGoogleCalendar.ts`, `logout.ts`) — deliberately deferred to follow-up plans; this plan establishes the pattern with the two highest-risk actions first. Do not expand scope to cover them here.
- Any behavior change to `confirmDeposit.ts` or `cancelBooking.ts` — this plan writes characterization tests for existing behavior. If a test reveals a bug, STOP per the conditions below rather than fixing it inline (a bug fix needs its own plan with its own review).
- `vitest.config.mts` (the unit-test config) — unchanged; these new tests belong in the integration config since they touch real Supabase, matching `bookings.test.ts`'s precedent.

## Git workflow

- Branch: `advisor/005-money-actions-tests`
- Commit per step; message style matches `git log` (e.g. `test: add coverage for confirmDeposit and cancelBooking`)
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Read the existing integration test precedent in full

Read `src/lib/__tests__/bookings.test.ts` completely. Note: how it sets up/tears down test data (does it create rows and delete them after? use a transaction? use a dedicated test-marker field?), how it imports and instantiates the Supabase client for direct DB access in tests, and how assertions are structured. This is the pattern the new tests must follow — do not invent a different setup/teardown approach.

Also read `src/lib/actions/admin/confirmDeposit.ts` and `src/lib/actions/admin/cancelBooking.ts` in full — these are the two files under test and weren't excerpted above; read them fresh to get accurate line numbers and current logic before writing tests against them.

**Verify**: no command — this is a research step. Proceed once both files are read and the setup/teardown pattern is understood.

### Step 2: Write `confirmDeposit.test.ts`

Create `src/lib/__tests__/confirmDeposit.test.ts` following the setup/teardown pattern from Step 1. Cover:
- Happy path: a `pending` booking with `amount_paid: 0` gets `confirmDeposit` called with a valid deposit amount → booking status becomes `confirmed`, `amount_paid` updates correctly, in centavos (no float arithmetic — assert with `toBe`, exact integer equality, not `toBeCloseTo`).
- Rejects when called by an unauthenticated context (mirror how `createWalkIn.ts`'s `if (!user) return { success: false, ... }` pattern is tested, if `confirmDeposit` has the same guard — confirm this in Step 1's read).
- Rejects/handles gracefully when the booking doesn't exist or is already confirmed (idempotency/edge case — read the actual function to see what it currently does in this case, and assert that documented behavior, don't assume).

**Verify**: `pnpm test:integration` → new test file's cases all pass (requires `.env.local` configured — if not available in this environment, run `npx tsc --noEmit` to confirm the test file at least compiles correctly, and report that live integration-test execution was not possible in this environment).

### Step 3: Write `cancelBooking.test.ts`

Create `src/lib/__tests__/cancelBooking.test.ts` following the same pattern. Cover:
- Happy path: a `confirmed` or `pending` booking gets cancelled → status becomes `cancelled`.
- Already-cancelled booking → assert the actual current behavior (idempotent no-op, or an error — read `cancelBooking.ts` in Step 1 to know which).
- Unauthenticated rejection, same pattern as Step 2.

**Verify**: same as Step 2.

### Step 4: Wire both new files into the integration test config

In `vitest.integration.config.mts`, change:
```ts
include: ['src/lib/__tests__/bookings.test.ts'],
```
to:
```ts
include: [
  'src/lib/__tests__/bookings.test.ts',
  'src/lib/__tests__/confirmDeposit.test.ts',
  'src/lib/__tests__/cancelBooking.test.ts',
],
```

**Verify**: `pnpm test:integration` → all three files' tests run and pass.

## Test plan

(This plan's deliverable IS test coverage — the "test plan" is the steps above.) Structural pattern to follow: `src/lib/__tests__/bookings.test.ts` for Supabase-touching integration tests, `src/lib/__tests__/slotSelection.test.ts` for pure-function style (not applicable here, referenced for `describe`/`it` structure only). Verification: `pnpm test:integration` → all pass, including the new cases from Steps 2 and 3.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm test:run` exits 0 (unit tests still pass, unaffected)
- [ ] `pnpm test:integration` exits 0, including the new `confirmDeposit.test.ts` and `cancelBooking.test.ts` cases (or, if live Supabase creds aren't available in the executor's environment, `npx tsc --noEmit` confirms both new files compile and this limitation is explicitly reported)
- [ ] `src/lib/__tests__/confirmDeposit.test.ts` and `src/lib/__tests__/cancelBooking.test.ts` both exist and contain at least 3 test cases each (happy path + 2 edge cases per the Steps above)
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts (drift since this plan was written).
- Writing a characterization test reveals `confirmDeposit` or `cancelBooking` doesn't behave the way its name/usage implies (e.g. silently allows double-confirming a deposit, or doesn't validate amounts) — this is a real bug; report it precisely (function, line, what you expected vs. observed) rather than "fixing" it as part of this test-coverage plan.
- `.env.local` isn't available or `SUPABASE_SERVICE_ROLE_KEY` isn't set in the executor's environment, making `pnpm test:integration` impossible to run live — write the tests anyway (they're still valuable, someone with credentials can run them), confirm they typecheck, and clearly report this limitation rather than skipping the tests entirely.
- The setup/teardown pattern in `bookings.test.ts` turns out to create real, un-cleaned-up rows in a shared (possibly production-adjacent) Supabase project — if the test data isn't clearly scoped/tagged for cleanup, STOP and report before running tests that could pollute real data.

## Maintenance notes

- This plan deliberately covers only 2 of 12 untested action files. The remaining 10 (`createBooking.ts`, `createOnsite.ts`, `equipment.ts`, `updateSettings.ts`, `upsertSpecialHours.ts`, and the GCal connect/disconnect/sync actions) should get the same treatment in follow-up plans, using the pattern established here.
- If `bookings.test.ts`'s setup/teardown pattern turns out to be fragile or slow (e.g. it doesn't clean up properly, or takes a long time), that's worth fixing before scaling the pattern to 10 more files — flag it in the PR rather than propagating a flaky pattern.
- A reviewer should check that these tests actually assert integer centavo arithmetic exactly (`toBe`, not `toBeCloseTo`), per the project's stated invariant of never using floats for money.
