# Booking & Payment Test Cases — danes

Category codes used: **BOOK** (booking creation/flow), **PAY** (deposit/payment confirmation), **EQUIP** (equipment add-on), **SEC** (security).

Ground truth: this document is authoritative for test steps. `templates/TEST-EXECUTION-TRACKING.csv` records execution status only — do not infer steps from the CSV.

---

### TC-BOOK-001: Create a one-off booking, happy path

**Priority**: P0
**Type**: Integration
**Estimated Time**: 5 minutes

**Prerequisites**:
- Dev server running (`npm run dev`), Supabase project reachable
- No existing booking for the target date/time slot

**Test Steps**:
1. Navigate to `/book`
2. Select service (Rehearsal or Recording), pick a date and time slot with no conflicts
3. Fill in customer details (name, phone, optional email)
4. Submit booking
5. Note the confirmation code shown
6. Query `bookings` table for that `confirmation_code` (via Supabase dashboard or `psql`)

**Expected Result**:
✅ Booking row exists with `status = 'pending'`, `total_amount`/`deposit_amount` matching `service_types.rate_per_hour` × hours and the configured `deposit_pct` — computed server-side, not from any client-supplied value
✅ `payment_method` is set (not null/empty)
✅ Redirected to `/book/pay?code=...` showing the correct amount due

**Pass/Fail Criteria**:
- ✅ PASS: booking row correct, amounts match server-side computation, redirect correct
- ❌ FAIL: wrong amount, missing `payment_method`, or booking created despite a conflict

**Potential Bugs to Watch For**:
- Client-supplied price accepted instead of server recomputation (would let a customer manipulate `total_amount`)
- Timezone drift — verify `start_at`/`end_at` are stored with the `+08:00` (Asia/Manila) offset, not UTC-shifted

---

### TC-BOOK-002: Reject a booking that overlaps an existing one

**Priority**: P0
**Type**: Integration
**Estimated Time**: 4 minutes

**Prerequisites**:
- An existing confirmed or pending booking at a known date/time

**Test Steps**:
1. Attempt to create a second booking with a time range overlapping the existing one (even partially, e.g. starts 30 min before the existing one ends)
2. Submit

**Expected Result**:
✅ Booking rejected with a friendly error ("That time slot is already booked." or equivalent), not a raw Postgres exclusion-constraint error
✅ No new row inserted (verify via DB query)

**Pass/Fail Criteria**:
- ✅ PASS: rejected cleanly, no row inserted
- ❌ FAIL: booking created, or a raw/ugly DB error surfaces to the customer

**Potential Bugs to Watch For**:
- Race condition: fire two overlapping booking requests near-simultaneously (e.g. two browser tabs submitting within the same second) — exactly one should succeed. This is what the `bookings_no_overlap` EXCLUDE constraint exists to guarantee; this test verifies the constraint is still live and the app surfaces its rejection cleanly.

---

### TC-EQUIP-001: Book with equipment add-on, price and availability correct

**Priority**: P1
**Type**: Integration
**Estimated Time**: 5 minutes

**Prerequisites**:
- At least one `active = true` equipment item exists with a known `price_per_session` and `quantity`

**Test Steps**:
1. Start a booking, select a time slot
2. On the details step, select one or more equipment add-ons
3. Submit and reach the review page
4. Verify displayed total includes equipment fee(s)
5. Complete the booking
6. Query `booking_equipment` for the new booking, confirm `price_at_booking` matches the equipment's price at time of booking

**Expected Result**:
✅ Total = service total + equipment fee(s), all integer centavos, no floating-point rounding artifacts
✅ `booking_equipment` row(s) exist with correct `equipment_id`/`price_at_booking`

**Pass/Fail Criteria**:
- ✅ PASS: all math correct, rows present
- ❌ FAIL: price mismatch, missing rows, or non-integer amounts anywhere

**Potential Bugs to Watch For**:
- Admin changes equipment price *after* this booking was made — `price_at_booking` should NOT retroactively change (it's a snapshot, per the code's own comment in `createBooking.ts`)

---

### TC-EQUIP-002: Concurrent booking requests for the last unit of equipment (race condition)

**Priority**: P0
**Type**: Integration / Concurrency
**Estimated Time**: 10 minutes

**Prerequisites**:
- An equipment item with `quantity = 1` (or set one to 1 for this test) and `active = true`
- No existing bookings using it in the target time window
- This test directly verifies plan 016's fix (`reserve_equipment` RPC + `pg_advisory_xact_lock`, migration `20260022000000_equipment_atomic_reserve.sql`, applied live 2026-07-21)

**Test Steps**:
1. Prepare two booking requests for the *same* single-quantity equipment item and *overlapping* time windows (can be scripted — fire both via `fetch`/curl near-simultaneously, or use two browser tabs and submit within the same second)
2. Submit both concurrently
3. Query `booking_equipment` for that equipment_id in that time window afterward

**Expected Result**:
✅ Exactly one request succeeds; the other receives `"<equipment name> is unavailable for the selected time."`
✅ Exactly one `booking_equipment` row exists for that equipment/time window — never two
✅ The failed request's `bookings` row does NOT exist (compensating delete should have removed it — see `createBooking.ts`'s `reserveError`/`unavailableRows` handling)

**Pass/Fail Criteria**:
- ✅ PASS: exactly one reservation succeeds, no orphaned booking row from the failed attempt
- ❌ FAIL: both succeed (double-booked gear), or a failed attempt leaves a dangling `bookings` row with no equipment

**Potential Bugs to Watch For**:
- This is the exact race the fix targets — if this test ever fails, it's a P0 regression, not an edge case
- Also run `src/lib/__tests__/equipmentReserve.integration.test.ts` with real `.env.local` credentials — it automates this same scenario and currently self-skips without them

---

### TC-PAY-001: Manual QR/bank-transfer payment flow, end to end

**Priority**: P0
**Type**: E2E
**Estimated Time**: 6 minutes

**Prerequisites**:
- A pending booking exists (from TC-BOOK-001) with its confirmation code
- Admin has configured a GCash QR image and/or bank details in `/admin/settings`

**Test Steps**:
1. Visit `/book/pay?code=<code>`
2. Confirm the GCash QR code image and/or bank transfer details render, along with the amount due
3. Upload a payment screenshot via the proof-upload widget
4. Confirm redirect to `/book/confirm?code=...&proof=uploaded`
5. Log in to `/admin`, find the pending booking, click confirm payment, enter the amount received
6. Verify booking `status` flips to `confirmed`, `amount_paid` is set
7. Verify a confirmation email was sent (check Resend logs or the test inbox)

**Expected Result**:
✅ Full flow completes with no errors at any step
✅ Booking status and `amount_paid` correct after admin confirmation
✅ Confirmation email sent

**Pass/Fail Criteria**:
- ✅ PASS: every step succeeds, final state correct
- ❌ FAIL: any step errors, or final `amount_paid`/`status` incorrect

**Potential Bugs to Watch For**:
- This is the *only* live payment path (PayMongo is intentionally unwired — see `HANDOFF.md`) — do not test PayMongo-specific flows, they don't exist in production

---

### TC-PAY-002: confirmDeposit rejects non-integer amounts

**Priority**: P1
**Type**: Unit (already automated — see `src/lib/__tests__/confirmDeposit.test.ts`)
**Estimated Time**: 2 minutes (manual re-verification)

**Prerequisites**:
- A pending/confirmed booking exists

**Test Steps**:
1. Call `confirmDeposit(bookingId, 150.5)` directly (or trigger via a modified admin UI request if testing end-to-end)
2. Observe the result

**Expected Result**:
✅ `{ success: false, error: 'Invalid amount.' }`
✅ No DB write occurs (booking `amount_paid` unchanged)

**Pass/Fail Criteria**:
- ✅ PASS: rejected cleanly, no DB mutation
- ❌ FAIL: float value written to `amount_paid`

**Potential Bugs to Watch For**:
- This is already covered by an automated unit test (plan 017) — this manual test case exists for the QA baseline's OWASP A08 (Data Integrity) coverage tracking, not because a gap is suspected

---

### TC-PAY-003: QR/payment upload rejects non-image files server-side

**Priority**: P1
**Type**: Security
**Estimated Time**: 4 minutes

**Prerequisites**:
- Admin session logged in
- Migration `20260023000000_payment_qr_mime_type_restriction.sql` applied (confirmed live 2026-07-21)

**Test Steps**:
1. In `/admin/settings`, attempt to upload a non-image file renamed with an image extension (e.g. a `.txt` file renamed to `qr.png`) via the QR upload widget
2. If the client-side check blocks it, bypass via a direct API call to Supabase Storage's upload endpoint with a spoofed `Content-Type: image/png` header and the same non-image bytes (use a REST client, not the browser UI, to actually test server-side enforcement — the client check alone proves nothing about the bucket policy)

**Expected Result**:
✅ Client-side: rejected with "Upload an image file."
✅ Server-side (the real test): the direct API bypass attempt is rejected by Supabase Storage's `allowed_mime_types` bucket policy, not just by the client

**Pass/Fail Criteria**:
- ✅ PASS: both layers reject the non-image file
- ❌ FAIL: the direct API bypass succeeds (client-side-only enforcement, spoofable)

**Potential Bugs to Watch For**:
- If this fails, it means the migration didn't actually apply correctly or the bucket ID doesn't match — re-verify via `supabase migration list` and the Supabase dashboard's Storage → payment-qr → Policies

---

## Coverage summary for this document

7 test cases: BOOK (2), EQUIP (2), PAY (3). P0: 4 (BOOK-001, BOOK-002, EQUIP-002, PAY-001), P1: 3 (EQUIP-001, PAY-002, PAY-003).

"Admin routes require authentication" is deliberately not repeated here —
already covered by `09-SECURITY-TEST-CASES.md` (TC-SEC-001/002/003) and
`01-AUTH-TEST-CASES.md` (TC-AUTH-004). This document only adds what those
don't cover: server-computed pricing correctness, the equipment
double-booking race (plan 016), and payment-input validation (plans 017,
022).

Not yet covered by this document or the existing 01-09 suite (write
follow-up categories as needed):
- Admin-side booking creation deposit correctness (`createOnsite`'s
  `deposit_pct` fix, plan 018) — `04-NEW-BOOKING-TEST-CASES.md` and
  `05-WALKIN-TEST-CASES.md` cover the UI flows but not this specific
  regression
- Recurring bookings (plan 031, once built)
- Dashboard stats accuracy after plan 027's single-pass aggregation
  rewrite — `TC-DSH-005`/`TC-DSH-006` in the tracking CSV cover this
  generally; re-run them as regression checks against plan 027
