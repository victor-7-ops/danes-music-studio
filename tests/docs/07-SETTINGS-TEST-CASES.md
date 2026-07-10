# Settings Test Cases

## TC-SET-001 — Settings page loads current values
**Priority:** P0
**Arrange:** Logged in. Settings exist in DB.
**Act:**
1. Navigate to `/admin/settings`
**Assert:** All fields pre-populated: hourly rate, operating hours open/close, hold window, deposit pct, reminder toggle.

---

## TC-SET-002 — Hourly rate field — type 350 shows 350 not 0350
**Priority:** P0
**Arrange:** On settings page. Rate field shows empty (was 0).
**Act:**
1. Click into hourly rate input
2. Type "350"
**Assert:** Field shows "350". No leading zero prepended. Value is 350 not 0350.

---

## TC-SET-003 — Save settings shows success message
**Priority:** P1
**Arrange:** Settings page loaded with current values.
**Act:**
1. Click "Save Settings" without changing anything
**Assert:** "Settings saved" success message appears. Disappears after ~3 seconds.

---

## TC-SET-004 — Operating hours save correctly
**Priority:** P1
**Arrange:** Settings page.
**Act:**
1. Change Opening time to 08:00
2. Change Closing time to 23:00
3. Save
**Assert:** Success shown. Reload page. Values persist as 08:00 / 23:00.

---

## TC-SET-005 — Hold window minutes saves
**Priority:** P1
**Arrange:** Settings page.
**Act:**
1. Change Hold window to 30
2. Save
**Assert:** Success. Reload. Value persists as 30.

---

## TC-SET-006 — Default deposit percentage saves
**Priority:** P1
**Arrange:** Settings page.
**Act:**
1. Change Default deposit to 30
2. Save
**Assert:** Success. Reload. Value persists as 30.

---

## TC-SET-007 — Reminder toggle saves
**Priority:** P1
**Arrange:** Settings page.
**Act:**
1. Toggle "Send booking reminders" checkbox
2. Save
**Assert:** Success. Reload. Checkbox reflects new value.
