# Baseline Metrics - danes

**Date**: 2026-07-21
**Purpose**: Pre-QA snapshot for comparison during testing

---

## 1. Test Coverage (Current State)

### Unit Tests
- **Total Tests**: 349 (vitest, `npm run test:run`)
- **Passing**: 349 (100%)
- **Failing**: 0
- **Skipped**: 2 (live-DB integration tests requiring `.env.local` + `SUPABASE_SERVICE_ROLE_KEY`, not runnable in CI/sandboxed environments)
- **Coverage**: not measured (no `--coverage` run yet — no coverage tool configured in package.json)
- **Money-moving action coverage** (as of plan 019, 2026-07-21): `createBooking`, `confirmDeposit`, `cancelBooking`, `equipment.ts` (create/update/delete) all now have unit tests via a shared Supabase mock (`src/lib/__tests__/supabaseMock.ts`). Pure helpers (`equipmentAvailability`, `dashboardPeriod`, `slotSelection`, `bookings` overlap, `imageMagicBytes`, `telegram`, `availability`) also covered.

### Integration Tests
- **Total Tests**: 2 (`src/lib/__tests__/bookings.test.ts`, `src/lib/__tests__/equipmentReserve.integration.test.ts`)
- **Status**: Not runnable without `.env.local` + live Supabase credentials — self-skip in sandboxed/CI environments (confirmed during plan 016 execution). Run manually with real credentials before trusting the equipment-reservation concurrency test.

### E2E Tests
- **Total Tests**: 0 (none exist yet — `tests/e2e/` created by this QA init but empty)
- **Browsers Covered**: none yet

---

## 2. Known Issues (Pre-QA)

Sourced from the `improve`-skill audit run 2026-07-21 (`plans/README.md` is
the live tracker — check it for current status before trusting this list).

### Critical Issues (all fixed as of commit `dda902c`/`2b40cf3`, verify still true)
- [x] Mobile viewport meta tag missing (site-wide, plan 015) — fixed, live-browser verified.
- [x] Equipment double-booking race under concurrency (plan 016) — fixed via `reserve_equipment` RPC + advisory lock, migration applied to live DB.
- [x] `confirmDeposit` accepted non-integer amounts (plan 017) — fixed.
- [x] `createOnsite` hardcoded 50% deposit instead of configured `deposit_pct` (plan 018) — fixed.

### Technical Debt
- [ ] Plan 010 (dependency upgrade spike) — Next 14.2.35, React 18, Tailwind 3 all have newer majors available. Not started.
- [ ] Plan 012/012b (quick-rebook suggestion) — designed, not built.
- [ ] Plan 031 (recurring bookings implementation) — build plan written 2026-07-21, not started.
- [ ] No code-coverage tool configured — `npm run test:run` reports pass/fail only, not line/branch coverage.
- [ ] Equipment usage query (`createBooking.ts`) has a date-range filter (plan 021) but no upper bound on total bookings scanned per equipment item across all time — fine at current volume, flagged as a future perf item.

---

## 3. Security Status

### OWASP Top 10 Coverage
- [x] A01: Broken Access Control — `src/middleware.ts` gates all `/admin/*` on `getUser()`; single-role app by design (no privilege tiers to bypass). Not formally tested with adversarial cases yet.
- [ ] A02: Cryptographic Failures — Supabase-managed auth/session; not independently audited.
- [ ] A03: Injection — Supabase client uses parameterized queries throughout (no raw SQL string concatenation found in `src/lib/actions/**` during the 2026-07-21 audit), but not formally pen-tested.
- [ ] A04: Insecure Design — equipment double-booking race (plan 016) was exactly this category; fixed. No formal rate-limiting or anomaly detection on booking creation.
- [x] A05: Security Misconfiguration — QR/payment upload now enforces `allowed_mime_types` server-side (plan 022, migration applied live). CSRF state check added to Google OAuth callback (plan 001).
- [ ] A06: Vulnerable Components — no `npm audit` run yet as part of this QA pass.
- [x] A07: Authentication Failures — Google Calendar OAuth CSRF protection added (plan 001); admin auth uses Supabase `getUser()` (not `getSession()`, which doesn't revalidate server-side) throughout.
- [ ] A08: Data Integrity Failures — not formally tested.
- [ ] A09: Logging Failures — `console.error` used ad hoc in server actions; no structured/centralized security event logging.
- [ ] A10: SSRF — not applicable surface found yet (no user-controlled outbound URL fetches identified), not formally verified.

**Current Coverage**: 3/10 explicitly verified (30%) — see TC-SEC-* test cases below for the ones this QA pass should close out first.

---

## 4. Performance Metrics

- **Page Load Time**: [X]ms (average)
- **API Response Time**: [X]ms (p95)
- **Database Query Time**: [X]ms (average)

---

## 5. Code Quality

- **Linting Errors**: [NUMBER]
- **TypeScript Strict Mode**: [Yes/No]
- **Code Duplication**: [%]%
- **Cyclomatic Complexity**: [Average]

---

## 6. Predicted Issues

**CRITICAL-001**: [Title]
- **Predicted Severity**: P0/P1/P2
- **Root Cause**: [Analysis]
- **Test Case**: TC-XXX-YYY will verify
- **Mitigation**: [Recommendation]

---

**Next Steps**: Begin Week 1 testing with baseline established.
