# New Booking Test Cases

## TC-NBK-001 — Full form submission creates booking
**Priority:** P0
**Arrange:** Logged in. On `/admin/new-booking`.
**Act:**
1. Enter Date: tomorrow's date
2. Enter Start: 10:00
3. Enter End: 12:00
4. Enter Customer Name: "Test Customer"
5. Enter Customer Phone: "09171234567"
6. Leave email/band blank
7. Click "Create Booking"
**Assert:** Success screen shown with confirmation code (e.g. DANES-XXXX). Status shown as "Pending".

---

## TC-NBK-002 — Missing date shows error
**Priority:** P1
**Arrange:** New Booking form.
**Act:**
1. Leave Date blank
2. Fill Start: 10:00, End: 12:00, Customer Name, Phone
3. Click Create Booking
**Assert:** Error "Please fill in date, start time, and end time." appears. No booking created.

---

## TC-NBK-003 — Missing customer name shows error
**Priority:** P1
**Arrange:** New Booking form.
**Act:**
1. Fill Date, Start, End
2. Leave Customer Name blank
3. Fill Phone
4. Click Create Booking
**Assert:** Error "Customer name is required." appears.

---

## TC-NBK-004 — Missing phone shows error
**Priority:** P1
**Arrange:** New Booking form.
**Act:**
1. Fill Date, Start, End, Customer Name
2. Leave Phone blank
3. Click Create Booking
**Assert:** Error "Customer phone is required." appears.

---

## TC-NBK-005 — End time before start time shows error
**Priority:** P1
**Arrange:** New Booking form.
**Act:**
1. Fill Date, Customer Name, Phone
2. Enter Start: 14:00, End: 12:00
3. Click Create Booking
**Assert:** Error "End time must be after start time." appears.

---

## TC-NBK-006 — Optional email can be blank
**Priority:** P2
**Arrange:** New Booking form.
**Act:**
1. Fill required fields only, leave email empty
2. Submit
**Assert:** Booking created successfully. No email-related error.

---

## TC-NBK-007 — Optional band name can be blank
**Priority:** P2
**Same as TC-NBK-006 pattern.**

---

## TC-NBK-008 — Deposit received creates Confirmed status
**Priority:** P1
**Arrange:** New Booking form.
**Act:**
1. Fill required fields
2. Check "Deposit received" checkbox
3. Submit
**Assert:** Success screen shows "Status: Confirmed". Booking in DB has status = confirmed.

---

## TC-NBK-009 — No deposit creates Pending status
**Priority:** P1
**Arrange:** New Booking form.
**Act:**
1. Fill required fields
2. Leave "Deposit received" unchecked
3. Submit
**Assert:** Success screen shows "Status: Pending". DB status = pending.

---

## TC-NBK-010 — Success screen shows confirmation code
**Priority:** P0
**Arrange:** After successful booking creation.
**Act:**
1. Observe success screen
**Assert:** Confirmation code displayed prominently (format: DANES-XXXX). "View in Calendar" link present.

---

## TC-NBK-011 — New Booking button resets form
**Priority:** P1
**Arrange:** On success screen.
**Act:**
1. Click "New Booking" button
**Assert:** Form resets to blank state. All fields empty. No previous data shown.
