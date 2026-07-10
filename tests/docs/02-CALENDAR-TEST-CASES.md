# Calendar Test Cases

## TC-CAL-001 — Week view loads and shows bookings
**Priority:** P0
**Arrange:** Logged in. At least one booking exists in current week.
**Act:**
1. Navigate to `/admin/calendar`
**Assert:** Calendar renders in week view. Booking event visible on correct day/time slot.

---

## TC-CAL-002 — Switch to Month view
**Priority:** P1
**Arrange:** On `/admin/calendar`.
**Act:**
1. Click "Month" button in toolbar
**Assert:** Calendar switches to month view. Week columns replaced with month grid. No page reload required.

---

## TC-CAL-003 — Switch to Day view
**Priority:** P1
**Arrange:** On `/admin/calendar`.
**Act:**
1. Click "Day" button in toolbar
**Assert:** Calendar switches to single-day view showing today.

---

## TC-CAL-004 — Navigate to next week
**Priority:** P1
**Arrange:** On `/admin/calendar`, week view.
**Act:**
1. Click the forward (>) navigation arrow
**Assert:** Calendar advances to next week. Dates in header update.

---

## TC-CAL-005 — Navigate to previous week
**Priority:** P1
**Arrange:** On `/admin/calendar`, week view.
**Act:**
1. Click the back (<) navigation arrow
**Assert:** Calendar retreats to previous week. Dates in header update.

---

## TC-CAL-006 — Click booking event opens drawer
**Priority:** P0
**Arrange:** Logged in. Booking exists on calendar.
**Act:**
1. Click a booking event block on the calendar
**Assert:** BookingDrawer slides in from right. Overlay darkens background.

---

## TC-CAL-007 — Drawer shows correct booking details
**Priority:** P0
**Arrange:** Click a known booking event.
**Act:**
1. Open drawer for a specific booking
**Assert:** Confirmation code, band/customer name, date, time, deposit, paid, total all match database values.

---

## TC-CAL-008 — Drawer closes on X button
**Priority:** P1
**Arrange:** Drawer is open.
**Act:**
1. Click the X (close) button in drawer header
**Assert:** Drawer closes. Calendar visible again. No page reload.

---

## TC-CAL-009 — Drawer closes on overlay click
**Priority:** P1
**Arrange:** Drawer is open.
**Act:**
1. Click the dark overlay outside the drawer
**Assert:** Drawer closes.

---

## TC-CAL-010 — Drawer closes on Escape key
**Priority:** P1
**Arrange:** Drawer is open.
**Act:**
1. Press Escape key
**Assert:** Drawer closes.

---

## TC-CAL-011 — Drawer focus trap
**Priority:** P1
**Arrange:** Drawer is open.
**Act:**
1. Press Tab repeatedly
**Assert:** Focus cycles only within drawer elements. Focus does not reach calendar behind overlay.
2. Press Shift+Tab
**Assert:** Focus cycles backwards within drawer only.
