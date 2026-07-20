# 018 — Use configured deposit_pct in createOnsite instead of hardcoded 50%

Planned at commit: `02be9c6`.

## Priority / Effort

P2 (inconsistent money behavior across booking sources) / S

## Problem

`src/lib/actions/admin/createOnsite.ts:52`:

```ts
const deposit_amount = Math.floor(total_amount / 2)
```

This hardcodes a 50% deposit. Compare with
`src/lib/actions/admin/createWalkIn.ts:75` and `src/lib/slotSelection.ts:36`,
which both fetch and use `serviceType.deposit_pct` /
a `depositPct` value sourced from the `service_types` configuration table —
read both of those call sites yourself to confirm the exact field name and
computation pattern before writing the fix, since the exact expression
(e.g. `Math.floor(total_amount * deposit_pct / 100)` vs. some other
percentage representation — confirm whether `deposit_pct` is stored as
`50` meaning 50%, or `0.5`) must match what those two files already do.

**Impact**: an admin-created "onsite" booking silently gets a different
deposit amount than a walk-in or online booking for the identical service,
if the studio ever changes `deposit_pct` away from 50% in Settings. This is
a real behavioral inconsistency across booking sources, not just a style
nit — deposit amount is customer-facing money.

## Fix

1. In `src/lib/actions/admin/createOnsite.ts`, change the `service_types`
   select at line ~40-44 to also fetch `deposit_pct` alongside
   `rate_per_hour` (mirror the exact select shape used in
   `createWalkIn.ts`).
2. Replace `Math.floor(total_amount / 2)` with the same deposit computation
   expression used in `createWalkIn.ts`/`slotSelection.ts` — do not invent a
   new formula; copy the existing one so all three sources compute deposits
   identically.

## Files in scope

- `src/lib/actions/admin/createOnsite.ts` only.

## Files explicitly out of scope

- `createWalkIn.ts` and `slotSelection.ts` are the reference implementations
  — read them, don't modify them.
- Don't touch the `service_types` schema or settings UI.

## Verification

1. `npm run typecheck` passes.
2. Add/extend a test for `createOnsite` (check for an existing test file
   first; if none exists, this is a good moment to add one following the
   pattern of whatever test already covers `createWalkIn`, if one exists —
   if neither has tests, keep this test minimal: just assert the deposit
   math, don't scope-creep into full action test coverage, that's plan 019's
   job) asserting deposit_amount matches `total_amount * deposit_pct / 100`
   (or whichever exact formula is confirmed from `createWalkIn.ts`) rather
   than always being exactly half.
3. `npm run test:run` green.

## Done criteria

- `createOnsite` computes deposit using the same `deposit_pct`-driven
  formula as `createWalkIn`/`slotSelection`, not a hardcoded `/2`.
- Manual check: change `deposit_pct` in Settings to something other than 50,
  create an onsite booking, confirm the deposit reflects the new percentage.

## Maintenance note

Three call sites (`createOnsite`, `createWalkIn`, `slotSelection`) now
independently duplicate deposit-computation logic. Worth flagging as a
future dedup opportunity (extract to a shared `computeDeposit(totalAmount,
depositPct)` helper) but that's out of scope for this plan — don't do it
here, just note it for whoever picks up the next money-logic touch.
