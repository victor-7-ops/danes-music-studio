# Maintenance Test Cases

## TC-MNT-001 — Existing closures list loads
**Priority:** P1
**Arrange:** Logged in. At least one maintenance closure in DB.
**Act:**
1. Navigate to `/admin/maintenance`
**Assert:** Existing closures section shows closure entries with start/end datetime and reason.

---

## TC-MNT-002 — Empty closures shows empty state
**Priority:** P2
**Arrange:** No maintenance closures in DB.
**Act:**
1. Navigate to `/admin/maintenance`
**Assert:** "No maintenance closures scheduled." text shown. No empty list.

---

## TC-MNT-003 — Create closure with no conflicts
**Priority:** P0
**Arrange:** No bookings in the chosen time window.
**Act:**
1. Enter Start datetime: next Monday 00:00
2. Enter End datetime: next Monday 06:00
3. Enter Reason: "Deep clean"
4. Click "Schedule Closure"
**Assert:** Form resets. New closure appears in list with correct start/end/reason.

---

## TC-MNT-004 — Missing start/end shows error
**Priority:** P1
**Arrange:** Maintenance form.
**Act:**
1. Leave Start blank
2. Click Schedule Closure
**Assert:** Error "Please fill in both start and end date/time." appears.

---

## TC-MNT-005 — End before start shows error
**Priority:** P1
**Arrange:** Maintenance form.
**Act:**
1. Enter Start: 2026-07-01 10:00
2. Enter End: 2026-07-01 09:00
3. Click Schedule Closure
**Assert:** Error "End date/time must be after start date/time." appears.

---

## TC-MNT-006 — Closure overlapping bookings shows conflict warning
**Priority:** P0
**Arrange:** At least one confirmed/pending booking exists at known time window.
**Act:**
1. Enter Start/End that overlaps that booking
2. Click Schedule Closure
**Assert:** Conflict warning panel appears listing the affected booking(s). Save Anyway and Cancel buttons visible.

---

## TC-MNT-007 — Conflict warning lists booking details
**Priority:** P1
**Arrange:** Conflict warning triggered (TC-MNT-006).
**Act:**
1. Observe conflict list
**Assert:** Each conflict shows confirmation code, customer name, and time range.

---

## TC-MNT-008 — Save Anyway creates closure despite conflict
**Priority:** P1
**Arrange:** Conflict warning visible.
**Act:**
1. Click "Save Anyway"
**Assert:** Closure saved. Form resets. New closure appears in list. Affected bookings remain unchanged (not auto-cancelled).

---

## TC-MNT-009 — Cancel on conflict warning resets form
**Priority:** P1
**Arrange:** Conflict warning visible.
**Act:**
1. Click "Cancel"
**Assert:** Conflict warning disappears. Form fields cleared. No closure created.
