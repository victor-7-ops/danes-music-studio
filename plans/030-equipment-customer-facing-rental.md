# 030 — Customer-facing equipment rental at booking time

Planned at commit: `02be9c6`.

## Priority / Effort

P3 (direction — validated data model, no customer-facing UI yet) / M

## Problem

Recent commits (`fbd3317`, `b4654df`, `10e1641`, `f6047f6`, plus the admin
UI redesign) built out equipment quantity tracking, conflict-detection
(hardened further by plan 016), and full admin CRUD — all admin-side. No
`src/app/book/**` (or wherever the customer booking flow lives — confirm
exact path first) route currently surfaces equipment selection to
customers. HANDOFF.md still lists equipment/gear rental as future-phase
work. The hard part (data model + conflict logic) is already built and
being hardened; exposing it to customers at booking time is a comparatively
contained next increment that lets the studio monetize gear it already
tracks.

This adds a new pricing dimension (equipment fees) to what is currently a
simple hourly-rate × hours calculation — needs the same integer-centavos
discipline already enforced everywhere else in this codebase (see
CLAUDE.md invariant 3, referenced throughout). This is the main real risk
in this plan: get equipment pricing math wrong and it's the same class of
bug this codebase has clearly been careful to avoid elsewhere.

Before writing implementation steps, read the actual current customer
booking flow (find the route/component where a customer picks a service,
date, time — likely under `src/app/book/**` or `src/app/(public)/**`,
confirm exact structure first) and `src/lib/actions/createBooking.ts` in
full (it already accepts `selectedEquipment` per the plan-016 audit —
confirm whether that's currently only reachable from an admin path, or
already partially wired for customer use but just missing UI).

## Fix

This plan needs its exact scope confirmed against current code before
writing detailed steps — the investigation above may reveal the
server-action side is already customer-ready (just needs UI) or needs
extension. Structure the actual implementation plan (write it as an update
to this file, or note if it needs to become several smaller plans) around:

1. **Pricing**: equipment fee per item (flat? per-hour multiplied by
   booking duration? confirm what `equipment` table already stores —
   check its columns) added to `total_amount`, using the same integer-
   centavos arithmetic pattern as the rest of the codebase — no floats,
   no `/` without `Math.floor`/`Math.round` matching existing conventions.
2. **UI**: equipment selection step in the customer booking flow — only
   show equipment marked `active`, only show quantity actually available
   for the selected date/time (reuse `getUnavailableEquipment` from
   `src/lib/equipmentAvailability.ts` for the availability display, don't
   reimplement it).
3. **Wiring to createBooking**: confirm `selectedEquipment` is already
   accepted by the customer-facing call path to `createBooking` (per the
   plan-016 investigation) — if it's currently admin-only, extend the
   customer flow to pass it through.
4. Confirm this plan is sequenced *after* plan 016 (equipment race fix)
   lands — exposing equipment selection to a much higher-volume customer
   audience (vs. admin-only today) meaningfully increases the concurrency
   risk that 016 is fixing. Do not ship customer-facing equipment
   selection before 016 is done.

## Files in scope

- Customer booking flow UI (exact path TBD from investigation step).
- `src/lib/actions/createBooking.ts` only if the customer path needs new
  wiring for `selectedEquipment` — don't touch if already wired.

## Files explicitly out of scope

- Admin equipment CRUD (`src/lib/actions/admin/equipment.ts`,
  `SettingsClient.tsx`/`EquipmentPanel.tsx`) — already built, don't modify.
- Plan 016's locking/transaction fix — dependency, not scope.

## Verification

1. `npm run typecheck` passes.
2. Manual test: as a customer, book a session with equipment selected,
   confirm total_amount reflects equipment fees correctly (verify the
   exact centavo math against a hand-calculated expected value).
3. Manual test: attempt to select equipment that's unavailable for the
   chosen time, confirm it's correctly excluded/disabled in the UI before
   submission (not just rejected server-side after the fact).
4. Regression test: existing bookings without equipment still work
   unchanged.

## Done criteria

- Customers can select available equipment at booking time.
- Pricing is correct integer-centavos math, verified against hand
  calculation.
- Availability shown to customers matches server-side enforcement (no
  UI/server mismatch).
- Sequenced after plan 016.

## Maintenance note

If equipment pricing ever needs tiered/promotional rates, that's a
separate future plan — keep this implementation to flat per-item pricing
unless the `equipment` table schema investigation reveals otherwise.
