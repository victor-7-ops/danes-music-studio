# Walk-In Test Cases

## TC-WLK-001 — Submit creates walk-in booking
**Priority:** P0
**Arrange:** Logged in. On `/admin/walk-in`.
**Act:**
1. Verify Date pre-filled with today
2. Verify Start pre-filled with current hour
3. Enter End: one hour after start
4. Click "Book Walk-In"
**Assert:** Success screen with confirmation code. Booking source = walk_in in DB.

---

## TC-WLK-002 — Date defaults to today
**Priority:** P2
**Arrange:** Navigate to `/admin/walk-in`.
**Act:**
1. Observe Date field on load
**Assert:** Date input shows today's date (YYYY-MM-DD format matching current date).

---

## TC-WLK-003 — Start defaults to current hour
**Priority:** P2
**Arrange:** Navigate to `/admin/walk-in`.
**Act:**
1. Observe Start Time field on load
**Assert:** Start time shows current hour with :00 minutes (e.g. 14:00 if it's 2pm).

---

## TC-WLK-004 — End time before start shows error
**Priority:** P1
**Arrange:** Walk-in form.
**Act:**
1. Set Start: 14:00, End: 13:00
2. Click Book Walk-In
**Assert:** Error "End time must be after start time." shown. No booking created.

---

## TC-WLK-005 — Missing end time shows error
**Priority:** P1
**Arrange:** Walk-in form.
**Act:**
1. Leave End Time blank
2. Click Book Walk-In
**Assert:** Error "Please fill in date, start, and end time." shown.

---

## TC-WLK-006 — Optional band name can be blank
**Priority:** P2
**Arrange:** Walk-in form.
**Act:**
1. Leave band name blank, fill required fields
2. Submit
**Assert:** Booking created. band_name is null in DB.

---

## TC-WLK-007 — Success shows code and Book Another
**Priority:** P1
**Arrange:** After successful walk-in creation.
**Act:**
1. Observe success screen
**Assert:** Confirmation code visible. "Book Another" button present.

---

## TC-WLK-008 — Book Another resets form
**Priority:** P2
**Arrange:** On walk-in success screen.
**Act:**
1. Click "Book Another"
**Assert:** Form resets. Date = today, Start = current hour, End = empty.
