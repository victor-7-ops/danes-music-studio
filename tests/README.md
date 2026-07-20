# Danes Admin — QA Test Suite

## Structure

```
tests/
  docs/
    TEST-EXECUTION-TRACKING.csv   <- Update status here after each test
    BUG-TRACKING.csv              <- File bugs here
    01-AUTH-TEST-CASES.md
    02-CALENDAR-TEST-CASES.md
    03-BOOKINGS-TEST-CASES.md
    04-NEW-BOOKING-TEST-CASES.md
    05-WALKIN-TEST-CASES.md
    06-MAINTENANCE-TEST-CASES.md
    07-SETTINGS-TEST-CASES.md
    08-DRAWER-TEST-CASES.md
    09-SECURITY-TEST-CASES.md
    10-PAYMENT-EQUIPMENT-TEST-CASES.md
    BASELINE-METRICS.md           <- Pre-QA snapshot (unit test count, OWASP coverage, known issues)
    MASTER-QA-PROMPT.md           <- Copy-paste prompt for autonomous LLM test execution
  e2e/       <- Playwright tests (future)
  fixtures/  <- Test data seeds (future)
```

## Test Count: 90 test cases

| Category            | Count | P0 | P1 | P2 |
|----------------------|-------|----|----|----|
| Auth                 | 7     | 4  | 3  | 0  |
| Calendar             | 11    | 3  | 7  | 1  |
| Bookings             | 7     | 1  | 4  | 2  |
| New Booking          | 11    | 2  | 6  | 3  |
| Walk-In              | 8     | 1  | 4  | 3  |
| Maintenance          | 9     | 2  | 6  | 1  |
| Settings             | 7     | 2  | 5  | 0  |
| Drawer               | 7     | 3  | 3  | 1  |
| Security             | 5     | 4  | 1  | 0  |
| Payment/Equipment    | 7     | 4  | 3  | 0  |
| **Total**            | **90**| **26** | **42** | **11** |

Payment/Equipment (10) targets what the 2026-07-21 `improve`-skill audit
fixed: server-computed pricing, the equipment double-booking race (plan
016), and payment-input validation (plans 017, 022) — deliberately doesn't
repeat auth checks already covered by 01/09.

## Quality Gates

| Gate           | Target | Status |
|----------------|--------|--------|
| Test execution | 100%   | 0/90   |
| Pass rate      | >=80%  | -      |
| P0 bugs open   | 0      | -      |
| P1 bugs open   | <=5    | -      |

## How to Execute

1. Open `docs/TEST-EXECUTION-TRACKING.csv`
2. Read test steps from the relevant category `.md` file
3. Execute in browser at `localhost:3000`
4. Update Status column: `Pass` / `Fail` / `Skip`
5. If Fail: add row to `BUG-TRACKING.csv` with Bug ID, severity, repro steps

## Bug Severity

- **P0** — Security hole or booking data corruption. Fix before any deploy.
- **P1** — Feature broken with no workaround. Fix this sprint.
- **P2** — Minor issue or cosmetic. Fix next sprint.
- **P3** — Nitpick. Backlog.

## Environment

- URL: `localhost:3000`
- Auth: Admin Supabase credentials
- DB: Local Supabase or staging
