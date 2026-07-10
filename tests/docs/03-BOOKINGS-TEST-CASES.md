# Bookings Test Cases

## TC-BKG-001 — Bookings list loads all bookings
**Priority:** P0
**Arrange:** Logged in. Multiple bookings exist.
**Act:**
1. Navigate to `/admin/bookings`
**Assert:** Table renders with booking rows. Columns: Date, Time, Code, Band/Customer, Status, Source, Deposit, Paid, Total.

---

## TC-BKG-002 — Filter by status Pending
**Priority:** P1
**Arrange:** Bookings page loaded. Mix of statuses in DB.
**Act:**
1. Select "Pending" from Status dropdown
2. Click Filter
**Assert:** Only pending bookings shown. URL contains `?status=pending`.

---

## TC-BKG-003 — Filter by status Confirmed
**Priority:** P1
**Arrange:** Bookings page loaded.
**Act:**
1. Select "Confirmed" from Status dropdown
2. Click Filter
**Assert:** Only confirmed bookings shown.

---

## TC-BKG-004 — Filter by date range
**Priority:** P1
**Arrange:** Bookings page loaded.
**Act:**
1. Enter From date
2. Enter To date
3. Click Filter
**Assert:** Only bookings with start_at within range shown.

---

## TC-BKG-005 — Clear filters restores full list
**Priority:** P1
**Arrange:** Filter applied showing subset.
**Act:**
1. Click "Clear" link
**Assert:** All filters removed. Full booking list restored. URL is `/admin/bookings`.

---

## TC-BKG-006 — Money columns are tabular-aligned
**Priority:** P2
**Arrange:** Bookings list with multiple rows.
**Act:**
1. Inspect Deposit, Paid, Total columns visually
**Assert:** Decimal points and currency symbols align vertically across rows (tabular-nums applied).

---

## TC-BKG-007 — Empty state message
**Priority:** P2
**Arrange:** Apply filter that matches no bookings.
**Act:**
1. Filter by a date range with no bookings
**Assert:** "No bookings found." message shown. No broken table rows.
