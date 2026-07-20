# Plan 013: Spike — design recurring/weekly booking support (design doc, not implementation)

> **Executor instructions**: This is a SPIKE plan. Its deliverable is a
> design document answering specific open questions, NOT working code. Do
> not implement recurring bookings as part of this plan — that requires a
> follow-up plan written after this spike's questions are answered. If
> anything in the "STOP conditions" section occurs, stop and report.
>
> **Drift check (run first)**: `git diff --stat 7879781..HEAD -- src/lib/actions/createBooking.ts supabase/migrations/`
> Re-read the current booking-creation flow fresh regardless, since this
> spike's conclusions depend on exact current behavior.

## Status

- **Priority**: P2 (direction — flagged as highest-leverage retention feature for this business model)
- **Effort**: S for the spike itself; the resulting feature is L
- **Risk**: LOW for the spike (design-only); the eventual feature is MED-HIGH given interaction with the overlap constraint and payment flow
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `7879781`, 2026-07-13

## Why this matters

Bands rehearsing weekly are this studio's core repeat-customer segment (per the business description and rate structure), yet every booking today is a single, independent `bookings` row created by re-running the full multi-step flow (`slots` → `details` → `review` → `pay`). A "repeat this slot every Tuesday for N weeks" option is plausibly the single highest-leverage retention feature available, but it isn't a simple insert-loop: it interacts non-trivially with the `bookings_no_overlap` EXCLUDE constraint (per-occurrence, so a series partially failing mid-creation needs a defined behavior), the manual QR/deposit payment flow (is there one deposit for the whole series, or one per occurrence? — this is an unresolved product question, not a technical one), and cancellation semantics (cancelling one occurrence vs. the whole series). This spike's job is to answer these questions on paper before any code is written, so the eventual implementation plan can be written with confidence instead of discovering these questions mid-build.

## Current state

- `src/lib/actions/createBooking.ts` — creates exactly one `bookings` row per call; no `recurrence_rule`, `parent_booking_id`, or series concept anywhere in the schema (`src/types/database.ts` — read this file in full during the spike to confirm no recurrence-related columns already exist by another name).
- `supabase/migrations/20260015000000_9_1_overlap_include_completed.sql` and whatever migration originally created `bookings_no_overlap` — the EXCLUDE constraint operates per-row; a batch-insert of N occurrences would need each occurrence checked independently, and a partial failure (e.g. week 3 of 8 conflicts with an existing booking) needs a defined UX: reject the whole series? Create the ones that succeed and report which failed? This is exactly the kind of question this spike must answer.
- Payment flow: manual QR + proof upload (PayMongo off). `src/app/book/pay/page.tsx` and `src/app/api/bookings/proof/route.ts` — read these to understand the current single-booking deposit/proof flow before proposing how it extends (or doesn't) to a series.
- `HANDOFF.md`'s documented constraint: money stays integer centavos, timezone Asia/Manila throughout — any recurring-booking date math (generating N future occurrence dates) must follow the same `+08:00` offset literal pattern already used in `createBooking.ts`/`createWalkIn.ts`, not a new date-handling approach.

## Commands you will need

Not applicable — this is a research/design spike, no code is written or run beyond reading existing files.

## Scope

**In scope**:
- Read: `createBooking.ts`, `createWalkIn.ts`, the overlap-constraint migrations, `book/pay/page.tsx`, `api/bookings/proof/route.ts`, `src/types/database.ts` in full.
- Produce: `plans/013a-recurring-bookings-design.md` — NOT a template-format executable plan, but a design document answering the open questions below, with a recommended answer for each (this spike's author should propose defaults, not just list questions, so a human reviewer can approve/adjust rather than starting from a blank page).
- If the design doc's conclusions are clear and low-risk enough, ALSO produce `plans/013b-recurring-bookings-implementation.md` as a full executable plan following the template — but only if Step 2 below reaches confident answers; if genuine product decisions remain (e.g. "does the owner want per-occurrence or per-series deposits" — that's not something code can decide), stop at the design doc and flag those as "needs owner input" rather than picking an answer speculatively.

**Out of scope**:
- Writing any recurring-booking code.
- Any schema migration.

## Git workflow

- No code changes. Deliverable is markdown file(s) under `plans/`.

## Steps

### Step 1: Read the full current booking-creation and payment flow

Read all files listed in "Current state" in full. Note precisely: what happens today when `createBooking` hits an overlap (single booking, single error) — this is the baseline behavior a series needs to generalize from.

**Verify**: no command — research step.

### Step 2: Answer the open design questions

Write `plans/013a-recurring-bookings-design.md` covering, at minimum:

1. **Recurrence pattern scope**: weekly-only (simplest, matches "same day/time every week" which is the overwhelmingly common band-rehearsal pattern), or also bi-weekly/custom? Recommend weekly-only for v1 — narrowest scope that captures the majority of value.
2. **Series length**: fixed N occurrences chosen at booking time (e.g. "4 weeks", "8 weeks"), or open-ended until cancelled? Recommend fixed N for v1 (simpler to reason about pricing/deposit, avoids indefinite recurring commitments neither party explicitly agreed to).
3. **Partial-conflict behavior**: if occurrence 3 of 8 conflicts with an existing booking, what happens? Recommend: show ALL conflicts upfront during the slot-selection step (query availability for every occurrence date before allowing checkout), reject the whole series creation if any occurrence conflicts, and let the customer adjust — do NOT recommend "create what succeeds, skip what fails" as the default, since that silently gives the customer a different series than what they thought they booked.
4. **Deposit/payment model**: one deposit covering the first occurrence only vs. the whole series, one deposit per occurrence, or full payment upfront for the series? This is explicitly a product/business decision, not a technical one — the spike should present options with tradeoffs (e.g. "per-occurrence deposits mean N separate proof-of-payment uploads, worse UX but lower no-show risk per session; one deposit for the series is simpler UX but the studio holds more risk if the customer stops showing up after week 2") and flag it as **needs owner input**, not pick one unilaterally.
5. **Cancellation semantics**: can a customer cancel a single occurrence within a series, or only the whole series? Recommend: allow single-occurrence cancellation (reuses the existing `cancel_token` pattern per occurrence — each occurrence is still its own `bookings` row under this design) while also offering "cancel entire series" as a bulk action.
6. **Schema shape**: recommend adding a `booking_series` table (`id`, `customer_*` fields, `recurrence_pattern`, `occurrence_count`, `created_at`) with a `series_id` foreign key added to `bookings`, rather than cramming recurrence metadata onto the `bookings` table itself — keeps each occurrence a normal `bookings` row (reusing all existing overlap-constraint, cancellation, and admin-calendar logic unchanged) while `booking_series` tracks the series-level concept.

For each question, state the recommendation AND why, so a reviewer can push back on specific points rather than approve/reject the whole document.

**Verify**: `plans/013a-recurring-bookings-design.md` exists and every numbered question above has a stated recommendation with reasoning.

### Step 3: Decide whether to proceed to an implementation plan

If Step 2's answers are all confidently resolved except question 4 (deposit model, which explicitly needs owner input regardless of how confident the rest is), write `plans/013b-recurring-bookings-implementation.md` scoped to everything EXCEPT the deposit-model-dependent parts, with a clear TODO marker where the deposit decision plugs in, OR stop at 013a and explicitly recommend getting owner input on question 4 before an implementation plan is written at all (this is the safer default given the deposit model affects the payment flow's core structure).

**Verify**: either `013b` exists with a clearly marked open dependency, or `013a` explicitly states implementation is blocked pending owner input on the deposit question, and this is reflected in `plans/README.md`.

## Test plan

Not applicable to this spike. Any implementation plan produced in Step 3 must include its own full test plan per the standard template.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `plans/013a-recurring-bookings-design.md` exists with all 6 questions answered
- [ ] Either `plans/013b-...md` exists (if unblocked) or `013a` explicitly states what's blocked and why
- [ ] `plans/README.md` updated with this plan's status and any new plan(s) produced
- [ ] No source code files modified (`git status` shows only new files under `plans/`)

## STOP conditions

Stop and report back (do not improvise) if:

- You find yourself wanting to just pick an answer for question 4 (deposit model) to keep moving — don't. That's a business decision this spike explicitly should NOT make unilaterally.
- Reading the actual payment/proof-upload flow reveals it's more tightly coupled to "exactly one booking per payment" than assumed here (e.g. the `proof` route or DB schema hardcodes a 1:1 booking-to-payment relationship in a way that's expensive to generalize) — if so, that's an important finding for the design doc itself, not a reason to abandon the spike; document it as a real constraint shaping the recommendation.

## Maintenance notes

- This spike deliberately produces a design doc, not code — resist pressure to "just build the simple version" without resolving the deposit-model question, since that question shapes the payment UX in a way that's expensive to change after customers start using it.
- Once the owner's answer to question 4 comes back, update `013a` with the resolved decision before writing `013b` (if not already written).
