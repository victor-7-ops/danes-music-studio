# Security Test Cases (OWASP)

## TC-SEC-001 — Unauthenticated GET /admin redirects
**Priority:** P0
**OWASP:** A01 Broken Access Control
**Arrange:** Clear all cookies/session.
**Act:**
1. Navigate to `localhost:3000/admin`
**Assert:** Redirected to `/admin/login`. Admin content not rendered.

---

## TC-SEC-002 — Unauthenticated GET /admin/bookings redirects
**Priority:** P0
**OWASP:** A01 Broken Access Control
**Arrange:** Clear all cookies.
**Act:**
1. Navigate to `localhost:3000/admin/bookings`
**Assert:** Redirected to `/admin/login`. No booking data visible.

---

## TC-SEC-003 — Unauthenticated server action returns error
**Priority:** P0
**OWASP:** A01 Broken Access Control
**Arrange:** Not logged in. Using curl or browser fetch.
**Act:**
1. POST to a server action endpoint without auth cookie
**Assert:** Returns 401 or redirect. No data mutation occurs.

---

## TC-SEC-004 — Login error does not expose stack trace
**Priority:** P1
**OWASP:** A05 Security Misconfiguration
**Arrange:** On login page.
**Act:**
1. Submit with wrong credentials
**Assert:** Generic error message ("Invalid login credentials" or similar). No stack trace, file paths, or internal error details exposed.

---

## TC-SEC-005 — XSS: band name with script tag is escaped
**Priority:** P0
**OWASP:** A03 Injection (XSS)
**Arrange:** Logged in.
**Act:**
1. Create new booking with Band Name: `<script>alert('xss')</script>`
2. Navigate to `/admin/bookings`
3. Open booking in drawer
**Assert:** Band name displayed as literal text. No alert popup. Script tag escaped in HTML.
