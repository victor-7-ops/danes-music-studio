# Auth Test Cases

## TC-AUTH-001 — Login with valid credentials
**Priority:** P0
**Arrange:** Dev server running. Valid admin email/password in Supabase.
**Act:**
1. Navigate to `localhost:3000/admin/login`
2. Enter valid email and password
3. Click Sign In
**Assert:** Redirected to `/admin/dashboard`. Sidebar visible.

---

## TC-AUTH-002 — Login with invalid credentials
**Priority:** P0
**Arrange:** Dev server running.
**Act:**
1. Navigate to `localhost:3000/admin/login`
2. Enter wrong email/password
3. Click Sign In
**Assert:** Error message appears. No redirect occurs. No page crash.

---

## TC-AUTH-003 — Login with empty fields
**Priority:** P1
**Arrange:** Dev server running.
**Act:**
1. Navigate to `localhost:3000/admin/login`
2. Click Sign In without filling any fields
**Assert:** Browser native validation or custom error shown. No server request made.

---

## TC-AUTH-004 — Unauthenticated redirect to /admin/login
**Priority:** P0
**Arrange:** Not logged in (clear cookies).
**Act:**
1. Navigate directly to `localhost:3000/admin/bookings`
**Assert:** Redirected to `/admin/login`. No admin content visible.

---

## TC-AUTH-005 — Login page no infinite redirect loop
**Priority:** P0
**Arrange:** Not logged in.
**Act:**
1. Navigate to `localhost:3000/admin/login`
**Assert:** Login form renders. No `ERR_TOO_MANY_REDIRECTS`. No redirect loop.

---

## TC-AUTH-006 — Logout clears session
**Priority:** P0
**Arrange:** Logged in as admin.
**Act:**
1. Click Logout in sidebar
2. Navigate to `localhost:3000/admin/bookings`
**Assert:** Redirected to `/admin/login`. Session cleared.

---

## TC-AUTH-007 — Authenticated user on login page redirects away
**Priority:** P1
**Arrange:** Already logged in.
**Act:**
1. Navigate to `localhost:3000/admin/login`
**Assert:** Redirected to `/admin`. Does not show login form again.
