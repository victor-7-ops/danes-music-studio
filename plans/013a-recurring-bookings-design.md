# Design 013a: Recurring/weekly booking support

## Status
Spike output for plan `013-recurring-bookings-spike.md`. Design document, not an executable plan. No code changes.

## What was read
- `src/lib/actions/createBooking.ts` — single-row insert, server-side pricing, `bookings_no_overlap` EXCLUDE-constraint error mapped to a user-facing message, hold window from `settings`, one confirmation code per row.
- `src/lib/actions/admin/createWalkIn.ts` — admin walk-in path, inserts as `status: 'completed'`, does its own app-level overlap pre-check (because `completed` rows didn't originally participate in the EXCLUDE constraint) plus still relies on the DB constraint as backstop.
- `src/lib/actions/admin/cancelBooking.ts` — admin cancel, single row `UPDATE status = 'cancelled'`, conditionally emails + deletes the gcal event only if it was `confirmed`.
- `src/app/api/booking/cancel/route.ts` — public self-serve cancel via `cancel_token` (random per-row UUID/token, one per booking), same single-row update.
- `supabase/migrations/20260002000000_1_2_bookings.sql` — original `bookings_no_overlap` EXCLUDE constraint, originally scoped to `status IN ('pending','confirmed')`.
- `supabase/migrations/20260015000000_9_1_overlap_include_completed.sql` — migration 9.1 closed a race: walk-in `completed` rows now also participate in the constraint (`WHERE status <> 'cancelled'`). This confirms the constraint is enforced per-row at the DB level regardless of how the row was created, which is good news for a "just insert more rows" recurrence design.
- `src/app/book/pay/page.tsx` — payment page is looked up **by `confirmation_code`** and shows one amount (deposit or full) for that one booking. No concept of a payment covering multiple bookings.
- `src/app/api/bookings/proof/route.ts` — proof upload is keyed by `ref` = one `confirmation_code`, requires that booking's `status === 'pending'`, writes `payment_proof_url` onto that single row, and fires one Telegram alert per proof upload.
- `src/types/database.ts` — confirms no `recurrence_rule`, `parent_booking_id`, `series_id`, or any series concept exists anywhere in the schema today. `bookings` is a flat table; `cancel_token` and `confirmation_code` are both per-row, generated at insert time.

## Confirmed constraint: payment flow is currently "one proof upload = one booking"
The proof-upload route hard-codes a single `ref` → single booking lookup, requires that one booking to be `pending`, and updates exactly that row. There is no batch/multi-booking upload path today. This is a real coupling, not an assumption — see Question 4 below for why this blocks committing to a payment model without owner input.

---

## Question 1: Recurrence pattern scope

**Recommendation: weekly-only for v1.**

Reasoning: the stated business driver is bands rehearsing on a fixed weekly slot. Bi-weekly/custom (every N weeks, specific weekdays, "every Tuesday and Thursday") adds real complexity to conflict-checking and UI without evidence anyone's asking for it. A `recurrence_pattern` field that's currently constrained to `'weekly'` (enum or check constraint) is trivial to extend later without a schema break, since occurrences are still materialized as normal rows — the pattern only controls *generation*, not storage.

## Question 2: Series length

**Recommendation: fixed N occurrences chosen at booking time.**

Reasoning: open-ended ("recur until cancelled") requires either (a) periodically materializing new future rows via a cron job, which adds an operational component and a failure mode where a band's next occurrence silently doesn't get created, or (b) computing occurrences virtually and never actually storing them until close to the date, which conflicts with "reuse existing `bookings` rows for overlap/calendar/admin logic unchanged" (Question 6). Fixed N lets the whole series (e.g. 8 or 12 weeks) be validated and inserted atomically at booking time — same request/response shape as today, just N rows instead of 1. A cap (e.g. max 26 occurrences) keeps this bounded. Renewal ("book another 8 weeks") is just running the flow again.

## Question 3: Partial-conflict behavior

**Recommendation (per plan default, confirmed): validate all N occurrences against existing bookings during slot selection, before any row is inserted. If any occurrence conflicts, reject the whole series and show the customer which date(s) conflict — do not create a partial series.**

Reasoning: silent partial creation ("occurrences 1–2 and 4–8 booked, occurrence 3 skipped") produces a series the band didn't actually agree to, with a support/refund headache if payment was already collected for the full amount. It also interacts badly with the EXCLUDE constraint: inserting N rows in one transaction where one collides means the whole `INSERT` fails anyway (transactional insert of multiple rows — if any row's tstzrange overlaps an existing constrained row, Postgres rejects the batch insert), so "all or nothing" is actually the *natural* behavior of a single multi-row `INSERT` inside one transaction, not extra work. The pre-check during slot selection is then purely a UX nicety (tell the customer *why* before they submit, rather than after a generic "something went wrong").

Implementation note for the (not-yet-written) implementation plan: compute all N `(start_at, end_at)` pairs client-side from the anchor day/time + weekly cadence, send them all to the server action, have the server do one `SELECT` overlap pre-check across all N ranges (a single query with `tstzrange && ANY(...)` or N small queries — either works at this row count), report the first/all conflicting dates back to the client without inserting anything, and only proceed to a single multi-row `INSERT` if the pre-check is clean. Still keep the EXCLUDE constraint as the authoritative backstop for the race window between pre-check and insert, exactly like `createBooking.ts` does today for single bookings.

## Question 4: Deposit/payment model — NEEDS OWNER INPUT

This is a product decision, not a technical one, and this spike does not pick an answer. Options, with tradeoffs:

**Option A — one deposit for the whole series, paid once, upfront.**
- Pro: simplest checkout — one proof upload, one Telegram alert, one admin confirmation click, matches the "book once" mental model bands have for recurring anything.
- Con: biggest deviation from the current 1-payment-proof-per-1-booking coupling (see above). Needs a new concept — either a `booking_series` row that owns the payment fields instead of the individual `bookings` rows, or a payment attached to the *first* occurrence that admin manually knows covers the rest. Confirming payment must mark all N occurrences `confirmed` together, and cancelling occurrence 3 mid-series raises a real question ("does the group get a partial refund, and does admin need to compute that manually?").
- Highest customer-facing simplicity, highest implementation/product-decision cost.

**Option B — full/deposit payment per occurrence, one proof upload per week, as today.**
- Pro: zero changes to `book/pay/page.tsx` or `api/bookings/proof/route.ts` — every occurrence is a normal `bookings` row with its own `confirmation_code`, `payment_method`, `payment_proof_url`, admin-confirm flow. This is the option that requires no changes to the payment coupling identified above.
- Con: worst customer experience for the actual use case — a band committing to 8 weeks has to come back and manually pay + upload proof 8 separate times, which undermines the "reduce friction for repeat customers" goal that motivated this spike in the first place. Also means 8x the Telegram alerts and 8x the admin manual-confirm clicks for one series, which is an operational cost on the manual QR flow.

**Option C — full payment upfront for the whole series, computed as N × per-occurrence total, one proof upload.**
- Pro: same one-time UX win as Option A without the "who owns partial refund" ambiguity of a deposit (no ongoing balance per occurrence).
- Con: for an 8+ week series this is a large one-time amount for the customer to front via manual GCash/bank transfer — may itself be a friction point for exactly the price-sensitive repeat customers this feature targets. Same schema/payment-coupling cost as Option A (needs a payment record that isn't 1:1 with a single `bookings` row, or needs to overload occurrence #1's payment fields to represent the group total, which is confusing for admin reading the booking list).

**Recommendation for the owner to weigh**: Option B is the only one that ships without touching the payment/proof coupling at all, so it's the cheapest and lowest-risk technically — but it's explicitly *not* the best answer to the retention problem the spike opens with. Options A/C solve the actual UX problem better but require deciding (a) where series-level payment state lives, (b) what "cancel one occurrence out of a paid-upfront series" means for refunds, and (c) whether admin's manual-confirm workflow needs a "confirm whole series" bulk action to avoid 8 separate clicks. **This spike flags the question and defers the choice — do not proceed to implementing the payment-touching parts of recurring bookings until the owner picks one.**

## Question 5: Cancellation semantics

**Recommendation: allow single-occurrence cancellation, reusing the existing per-row `cancel_token` pattern unchanged, plus add a "cancel entire series" bulk action (admin-side, and optionally customer-side via a series-level token) that iterates the existing single-cancel logic.**

Reasoning: `cancelBooking.ts` (admin) and `api/booking/cancel/route.ts` (public self-serve) both already operate on one row via `id` or `cancel_token`. If every occurrence is a normal `bookings` row with its own `cancel_token`, single-occurrence cancel needs **zero changes** to either file — a band skipping one week just cancels that one row exactly like a one-off booking. "Cancel whole series" is a thin wrapper that looks up all rows sharing a `series_id` and calls the existing cancel logic per row (in a loop or a single `UPDATE ... WHERE series_id = ...` for the DB half, but still triggering per-row email/gcal-delete side effects individually since those are per-occurrence). No new cancellation primitive needs to be invented.

## Question 6: Schema shape

**Recommendation: add a `booking_series` table, and a nullable `series_id` FK on `bookings`. Keep each occurrence a normal `bookings` row.**

```sql
CREATE TABLE booking_series (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name     text        NOT NULL,
  customer_phone    text        NOT NULL,
  customer_email    text        NOT NULL,
  band_name         text,
  service_type_id   uuid        NOT NULL REFERENCES service_types(id),
  recurrence_pattern text       NOT NULL DEFAULT 'weekly' CHECK (recurrence_pattern = 'weekly'), -- widen later
  occurrence_count  integer     NOT NULL CHECK (occurrence_count BETWEEN 1 AND 26),
  anchor_start_at   timestamptz NOT NULL,  -- first occurrence's start, for display/reference
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bookings ADD COLUMN series_id uuid REFERENCES booking_series(id);
CREATE INDEX bookings_series_id_idx ON bookings(series_id) WHERE series_id IS NOT NULL;
```

Reasoning:
- Every occurrence stays a first-class `bookings` row, so `bookings_no_overlap`, `cancelBooking.ts`, `api/booking/cancel/route.ts`, the admin calendar view, gcal push/delete sync, and reminder emails all keep working **completely unchanged** — none of them need to know a series exists. This is the biggest risk-reducer in the whole design: it means 90% of the feature is additive (new insert path + new `booking_series` table), not a rewrite of existing booking logic.
- `booking_series` holds only what's shared across occurrences and doesn't belong on any single row (customer info duplicated across occurrences is fine and mirrors how `createBooking.ts` already denormalizes customer info per booking today — no join required to read one occurrence).
- `series_id` is nullable and unindexed-by-default-except-partial, so it costs nothing for the 99% of bookings that aren't part of a series.
- Money fields (`total_amount`, `deposit_amount`, `payment_method`, `payment_proof_url`, `confirmation_code`, `cancel_token`) deliberately stay on individual `bookings` rows, not on `booking_series` — this keeps Option B (Question 4) trivial to implement, and if the owner picks Option A/C later, the payment fields can be added to `booking_series` as a second migration without touching this base shape.

---

## Blocked / not blocked

Everything above except Question 4 is confidently resolved with a stated recommendation and no material technical risk identified. Question 4 is explicitly a product/business decision this spike will not make unilaterally.

**Per the plan's step 3 default (the expected/safer outcome): this spike stops here.** No `013b-recurring-bookings-implementation.md` is produced yet.

Reasoning for stopping rather than writing a "payment-agnostic" implementation plan: the schema shape in Question 6 already accommodates all three payment options without rework, and the multi-row insert / conflict-check / cancellation logic in Questions 1–3 and 5 don't depend on the payment answer. But the *booking creation flow itself* — specifically, what the `/book` UI asks for and what `createSeriesBooking` (the new server action) redirects to after insert — is directly shaped by which payment option is chosen (redirect to one `/book/pay?code=X` for the whole series vs. N separate pay links vs. a new series-pay page). Writing an implementation plan now would either bake in a guess at the payment model (contradicting the instruction not to pick one) or leave the most customer-visible part of the flow as a TODO stub, which isn't a useful executable plan. Once the owner picks A, B, or C, a follow-up spike step (or directly `013b`) can be written in under an hour referencing this document — the schema, conflict-check, and cancellation sections above do not need to be revisited.

## Recommendation for the owner
Answer Question 4 (deposit/payment model — Option A, B, or C, or a variant). Once answered, `013b-recurring-bookings-implementation.md` can be written as a normal executable plan against this design.
