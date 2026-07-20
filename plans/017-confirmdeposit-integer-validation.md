# 017 — Enforce integer-centavos validation in confirmDeposit

Planned at commit: `02be9c6`.

## Priority / Effort

P2 (money-invariant violation, real but requires a float input to trigger) / S

## Problem

`src/lib/actions/admin/confirmDeposit.ts:21-23`:

```ts
if (typeof amountReceived !== 'number' || amountReceived < 0) {
  return { success: false, error: 'Invalid amount.' }
}
```

This is missing an `Number.isInteger(amountReceived)` check. Every other
money-handling action in this codebase enforces the integer-centavos
invariant explicitly — confirm this yourself before starting by reading
`src/lib/actions/createBooking.ts`, `src/lib/actions/admin/updateSettings.ts`,
and `src/lib/actions/admin/equipment.ts` and noting each one's
`Number.isInteger(...)` check on money fields. `confirmDeposit` is the odd
one out.

**Impact**: if a float ever reaches this function (e.g. a future UI bug that
computes a percentage and doesn't round, or a manual API call), it gets
written directly into `bookings.amount_paid` uncaught. That value then flows
into `src/lib/emails/format.ts` (customer-facing confirmation emails) and
`src/lib/telegram.ts` (admin alerts) — a fractional centavo showing up in a
receipt is confusing and violates the codebase's own stated invariant (see
CLAUDE.md invariant 3, referenced in comments elsewhere in this codebase,
e.g. `src/app/admin/dashboard/page.tsx:3`).

## Fix

In `src/lib/actions/admin/confirmDeposit.ts`, change:

```ts
if (typeof amountReceived !== 'number' || amountReceived < 0) {
  return { success: false, error: 'Invalid amount.' }
}
```

to:

```ts
if (typeof amountReceived !== 'number' || !Number.isInteger(amountReceived) || amountReceived < 0) {
  return { success: false, error: 'Invalid amount.' }
}
```

Match the exact error message style already used (`'Invalid amount.'`) —
don't invent a new one.

## Files in scope

- `src/lib/actions/admin/confirmDeposit.ts` — the only file that needs
  changing.

## Files explicitly out of scope

- Don't touch the UI that calls `confirmDeposit` (find its caller via a
  search for `confirmDeposit(` in `src/app/admin/**`) unless you find it's
  currently capable of sending a non-integer value — if so, note that as a
  follow-up, don't silently expand this plan's scope to fix it too.

## Verification

1. `npm run typecheck` passes.
2. Add a unit/integration test (find the existing test pattern for other
   admin actions, e.g. check for a `confirmDeposit.test.ts` or add one under
   `src/lib/actions/admin/__tests__/` matching the codebase's existing test
   file location convention) asserting: `confirmDeposit(validId, 150.5)`
   returns `{ success: false, error: 'Invalid amount.' }`, and
   `confirmDeposit(validId, 150)` proceeds past validation (mock the
   Supabase client per the existing test-mocking pattern in this repo, if
   any exists — check `vitest.config` setup files first for a shared mock
   helper before writing a new one).
3. `npm run test:run` green.

## Done criteria

- Passing a float `amountReceived` returns the invalid-amount error.
- Passing a valid integer still succeeds as before.
- New test committed and passing in CI.

## Maintenance note

If this codebase ever centralizes money validation into a shared helper
(e.g. `isValidCentavos(n)`), migrate this check there — right now each
action duplicates the same `Number.isInteger(...) && n >= 0` check
independently, which is exactly how this gap happened in the first place.
