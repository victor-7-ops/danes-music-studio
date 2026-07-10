# Booking Drawer Action Test Cases

## TC-DRW-001 — Confirm deposit on pending booking
**Priority:** P0
**Arrange:** Pending booking exists. Open its drawer from calendar.
**Act:**
1. Verify "Amount received" input shows deposit amount
2. Click "Confirm Deposit"
**Assert:** Drawer closes. Calendar refreshes. Booking status changes to confirmed in calendar and DB.

---

## TC-DRW-002 — Cancel pending booking
**Priority:** P0
**Arrange:** Pending booking drawer open.
**Act:**
1. Click "Cancel Booking"
2. Confirmation step appears — click "Yes, cancel"
**Assert:** Drawer closes. Calendar refreshes. Booking disappears from calendar (cancelled bookings excluded from calendar query).

---

## TC-DRW-003 — Cancel confirmed booking
**Priority:** P0
**Arrange:** Confirmed booking drawer open.
**Act:**
1. Click "Cancel Booking"
2. Click "Yes, cancel"
**Assert:** Booking status = cancelled in DB. Removed from calendar.

---

## TC-DRW-004 — Cancel confirmation step appears
**Priority:** P1
**Arrange:** Drawer open on cancellable booking.
**Act:**
1. Click "Cancel Booking"
**Assert:** "Cancel this booking?" prompt with "Yes, cancel" and "Back" buttons appears. No immediate cancellation.

---

## TC-DRW-005 — Back button dismisses cancel confirmation
**Priority:** P1
**Arrange:** Cancel confirmation step showing.
**Act:**
1. Click "Back"
**Assert:** Confirmation step hidden. "Cancel Booking" button visible again. No action taken.

---

## TC-DRW-006 — Error message on action failure
**Priority:** P1
**Arrange:** Simulate failure (e.g. network error or booking already cancelled).
**Act:**
1. Attempt to confirm deposit on already-confirmed booking (edge case)
**Assert:** Error message appears in red below action buttons. Does not crash.

---

## TC-DRW-007 — Completed booking has no action buttons
**Priority:** P2
**Arrange:** Booking with status = completed. Open drawer.
**Act:**
1. Observe action area at bottom of drawer
**Assert:** No "Confirm Deposit" button. No "Cancel Booking" button. Only booking details visible.
