# Handoff — Danes Music Studio: Phase 1 finish + Phase 2-4

Full roadmap lives at `C:\Users\gadia\.claude\plans\i-want-you-to-composed-jellyfish.md`. Read it first — it has full context, decisions, and file references. This doc is the immediate pickup point.

## Repo state right now

Uncommitted changes (not yet committed — review then commit):
```
M  src/app/book/details/page.tsx
M  src/app/book/review/page.tsx
M  src/app/book/slots/page.tsx
M  src/components/booking/DetailsForm.tsx
M  src/components/booking/ReviewPage.tsx
M  src/components/booking/ReviewSummary.tsx
M  src/components/booking/SlotGrid.tsx
M  src/components/booking/SlotGridStep.tsx
M  src/lib/actions/admin/createWalkIn.ts
M  src/lib/actions/createBooking.ts
M  src/lib/slotSelection.ts
?? src/lib/services.ts
?? supabase/migrations/20260015000000_9_1_overlap_include_completed.sql
```

These implement Phase 1 (1a–1d) from the roadmap:
- `src/lib/services.ts` — new file, maps URL slugs (`rehearsal`/`recording`) to `service_types.name` rows.
- `createBooking.ts` / `createWalkIn.ts` — now accept a `service` slug, look up `rate_per_hour` + `deposit_pct` from `service_types` (was hardcoded to "Rehearsal" + 50%), and store `payment_method` on the booking insert (was silently dropped — the original bug).
- `slotSelection.ts` `computeTotal()` — takes `depositPct` param instead of hardcoded `/2`.
- Booking flow pages (`book/slots`, `book/details`, `book/review` + client components) — thread `service` through URL params, fetch real rate/deposit from `service_types` server-side instead of hardcoded `RATE_CENTS = 35000`.
- New migration `20260015000000_9_1_overlap_include_completed.sql` — extends the `bookings_no_overlap` EXCLUDE constraint to cover all non-cancelled rows (was pending/confirmed only), closing a walk-in double-booking race. Guarded by a pre-check that raises an exception if real overlapping data already exists.
- `createWalkIn.ts` now catches the exclusion-constraint violation with a friendly error message.

**Not yet done from Phase 1:**
1. Run `npx tsc --noEmit` in the repo root — fix any type errors from the above changes (interfaces were updated by hand across ~11 files, likely a prop-drilling mismatch somewhere).
2. Run `npx vitest run` — check existing tests still pass; add/update unit tests for: `computeTotal` with custom `depositPct`, `createBooking` storing `payment_method` correctly, service-slug validation rejecting bad input.
3. Apply the new migration to the local/dev Supabase instance and confirm it doesn't fail the overlap pre-check.
4. Manually walk the booking flow in the browser (`/book` → pick Recording → pick slots → details → review → confirm) and verify: correct ₱1000/hr rate shows, deposit amount matches `deposit_pct`, booking row gets `payment_method` set correctly.

## Then proceed through the roadmap in order

Per the plan file's "Execution notes": Phase 1 cleanup above → **Phase 2** (2a Telegram alerts → 2b cancel/reschedule + 2c manual QR payment in parallel → 2d richer admin pages) → **Phase 3** (equipment/gear rental) → **Phase 4** (premium landing page redesign, can be pulled earlier since it's independent of 2/3).

## Critical constraints (do not violate)

- **PayMongo is OFF.** `book/pay/page.tsx` must not call PayMongo in the live flow. Manual QR + proof upload (Phase 2c) is the only active payment path. **Do not delete** `src/lib/paymongo.ts` or `src/app/api/webhooks/paymongo/route.ts` — leave them in place, unwired, for future re-enablement.
- All money stays **integer centavos** — never floats, never pesos in DB columns.
- Timezone is **Asia/Manila** throughout — a recurring bug source per berty-courts' own CLAUDE.md; match danes' existing date-handling patterns already in the codebase (`+08:00` offset literals in `createBooking.ts` etc.) rather than inventing a new approach.
- Reference implementation for Phase 2/3 features lives in the sibling repo `C:\Users\gadia\Documents\Claude\berty-courts` — read the specific files named in the plan file before building each feature (e.g. `lib/telegram/send.ts`, `app/api/bookings/proof/route.ts`, paddle rental tables) rather than designing from scratch.
- Only commit when explicitly asked; the uncommitted Phase 1 diff above is intentionally left for review first.

## Verification approach for every phase

The plan file has a "Verification" subsection per phase (browser walkthroughs, specific test cases, migration safety checks). Follow those — don't just typecheck and call it done; the project's CLAUDE.md-style invariants (server-side price computation, DB-enforced overlap constraints) mean logic bugs here directly cause double-bookings or wrong charges.
