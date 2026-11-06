# Project handoff

Last updated: November 6, 2026 (Asia/Manila).

## Read this first

This is the current pickup note. It replaces the old Phase 1 checklist and references to plans on another computer. Read the source and current Git state before acting on historical reports.

- Repository: https://github.com/victor-7-ops/danes-music-studio
- Local checkout: `C:/Users/VictorAlexis Gadiana/Documents/Github/danes-music-studio`
- Production: https://danes-music-studio.vercel.app
- Local development: http://localhost:3000
- Latest verified application commit: `aafc083` on remote `main` (responsive bookings redesign).
- Local branch at handoff: `codex/audit-fixes`; application commits were pushed with `git push origin HEAD:main`.
- Production deployment for that commit: `dpl_EGfqxHAHccbm47FyKRBrtXqmVKKJ`, verified READY.
- Supabase production project: `hrvnoxhnwrnnwnlajejt` (Danes). A separate account also has another studio-named project; do not confuse them.
- Studio admin and connected Google Calendar account: `dmstudio.admin@gmail.com`. Never put passwords or tokens in documentation.

## Current behavior and completed work

- `/admin` redirects to `/admin/dashboard`. The responsive admin includes calendar, bookings, advanced booking, walk-in, maintenance, special hours, and settings.
- Customer reservations use the atomic `create_customer_reservations` RPC. Pricing and equipment snapshots are server-derived; room conflicts are enforced by the database.
- Payment is manual QR/bank transfer with private proof upload and admin verification. PayMongo remains disabled; preserve its unwired integration files.
- Authorization uses trusted `app_metadata.role = admin`, with database RLS. User-editable metadata cannot grant admin access.
- Google OAuth callback validates connection persistence. The production redirect URI is `https://danes-music-studio.vercel.app/api/auth/google/callback`.
- Confirmed onsite/walk-in bookings push to Calendar. Confirmation/cancellation await delivery attempts, and bookings expose manual Calendar/email recovery actions.
- Customer cancellation/reschedule POST handlers check database failures and redirect with HTTP 303. GET links remain read-only. Rescheduling currently cancels the original booking and opens a fresh booking flow; it does not atomically move the original reservation or transfer its payment.
- Scheduler jobs use Vault entries `studio_site_url` and `studio_cron_secret`. The latter must match Vercel `CRON_SECRET`. Reminder scheduling was restored to `0 * * * *` after testing; Calendar pull is hourly and watch renewal uses its existing six-day schedule.
- Calendar watch renewal uses the service client and checks database errors. The Google connection is retained; do not sign it out or disconnect it as part of routine testing.

## Most recent review and fixes

### Bookings UI follow-up (November 6)

The bookings page now uses responsive cards instead of the wide eleven-column table. Each card retains the full reference, customer/band, Manila date/time, status, source, payment method, total, paid amount, required deposit, and balance. Wide screens use two columns; phones use one column without sideways scrolling. Existing payment actions remain available.

Calendar/email recovery actions are inside a native `Calendar & email` disclosure. Controls have 44px minimum hit areas, specific loading feedback, and distinct success/error announcements. Filters retain their GET/query behavior, reset correctly after client-side clearing, and have separate filtered-empty and database-error states. No database or payment rules changed.

Local browser checks covered 375px, 768px, and 1440px widths, applying/clearing the pending filter, opening the recovery disclosure, and recovering from an invalid status filter. Ten targeted tests passed across three files, including unavailable pending recovery, server failure feedback, successful email feedback, existing retry authorization, and mixed-outcome drawer feedback. Lint and TypeScript passed. Production deployment `aafc083` is READY: the phone and desktop layouts have no page-level horizontal overflow, applying/clearing filters resets both controls and results, and Calendar recovery from the new disclosure returned `Calendar updated.`. Temporary viewport overrides were reset. This pass did not create bookings or resend customer emails.

`CODE_QUALITY_REVIEW.md` records a review of `0befe64..50160e6`. Both P2 findings were addressed in `80b96e2`:

1. Calendar event identity is resolved only in `src/lib/gcal/pushSync.ts`. `deleteGcalEvent` now accepts a booking with `id` and `gcal_event_id`; all four callers pass that booking. Stored legacy IDs and deterministic fallback IDs remain supported, as do repeated-delete 404/410 responses.
2. `cancelSeries` preserves each affected confirmation code and delivery warning. `BookingDrawer` displays delivery warnings together with partial cancellation failures; multiline warnings also remain readable in the calendar view.

The maintenance/special-hours trigger was repaired in `20261105134109_harden_database_execution.sql`: table-specific NEW fields are resolved in separate branches. Admin permission checks and booking-conflict guards remain enforced. Elevated function privileges were reduced, search paths pinned, and extensions moved out of public. Changes were exercised against production with synthetic transaction tests that rolled back.

## Verification evidence

- November 6 fresh deployed bookings QA: 21 targeted tests passed across BookingDeliveryActions, BookingDrawer, retryBookingDelivery, confirmDeposit, and customerCancellation. Live pending and date-range filters returned the expected empty state; clearing restored all three test records and reset the controls. Keyboard Enter opened the recovery disclosure, and Calendar retry on a cancelled TEST ONLY record returned `Calendar updated.`. Production layouts at 375px, 768px, and 1440px had no page-level horizontal overflow; no browser console warnings/errors were captured. Temporary viewport overrides were reset. No new booking, payment, or email-send cycle was performed in this pass.


- November 5: 31 targeted tests passed for the latest application change, including mixed cancellation outcomes, drawer warning display, legacy/fallback Calendar identity, customer cancellation/rescheduling, and retry handling. Lint and TypeScript passed. Vercel production build passed.
- November 6: both live Retry Calendar removal checks returned `Calendar updated.` on cancelled TEST ONLY bookings: one without a saved event ID and one with a saved legacy event ID. These checks exercise idempotent recovery of already removed events, not a new booking's initial event creation.
- Earlier: three live Supabase integration tests passed, covering atomic weekly reservations, rollback on conflict, and simultaneous reservation contention. `supabase/tests/schedule_guards.sql` passed with all writes rolled back.
- Earlier: customer cancellation and rescheduling each returned 303 to a working GET page; GET requests did not change pending bookings. Disposable fixtures were removed.
- Scheduled reminder verification used the actual cron job: HTTP 200, sent=1, errors=0, one attempt, lease cleared. Victor confirmed the test message arrived at the studio inbox. The temporary booking was removed and the hourly schedule restored.
- Mobile: all eight admin pages were checked at 375px; dashboard/bookings/calendar/settings were also checked at 768px and 1440px. Settings overflow and hidden-sidebar accessibility were fixed. Temporary viewport overrides were reset.
- Earlier public booking/proof/confirmation/cancellation email tests completed. No real payment was made. Three cancelled, labeled TEST ONLY booking records remain from browser verification; do not treat them as revenue or real reservations.

## Remaining work and explicit deferrals

- A separate standalone review of the `80b96e2` fixes or `aafc083` UI follow-up has not run. Victor's project instructions require an explicit invocation of `$thermo-nuclear-code-quality-review`; do not run the standalone skill automatically. Thermos is only authorized when Victor labels a change medium-risk.
- The only remaining Supabase security-advisor warning at the last check was leaked-password protection. The organization is on Free; the feature requires Pro or above. Victor explicitly deferred it. Do not upgrade billing or keep asking about it.
- Keep the existing email sender. Branded-domain sender work is deferred; ownership of `danesmusicstudio.com` was not established.
- Mixed provider/database failures were tested with mocks, not by deliberately breaking live production services. Do not describe the system as guaranteed bug-free.

## Working safely and keeping docs current

- Local `.env.local` was connected to the production Supabase project during verification. Do not assume local development means a disposable database; never seed or run destructive tests without checking the target.
- Do not publish `.env.local`, service keys, OAuth secrets, refresh/cancel tokens, or screenshots containing credentials. Do not rotate `GOOGLE_TOKEN_ENCRYPTION_KEY` casually: it encrypts the stored Calendar refresh token.
- Preserve integer centavos, Asia/Manila date handling, input validation, error handling, trusted-role checks, and RLS.
- Keep commits free of assistant attribution and coauthor trailers, per Victor's preference.
- Update this file whenever implementation, deployments, verification, decisions, or pending work change. Record what actually passed and its scope; keep prior checks distinct from a fresh full-system test.
- Local `AUDIT.md`, `BUILD_REPORT.md`, `IMPLEMENTATION_PLAN.md`, and `audit/` may contain historical material not tracked on the remote. They are not a replacement for current source or this handoff. Do not stage unrelated files blindly.

## Commands and key files

Use Node 22.14.x and the package manager declared in `package.json` (pnpm 12.11.2). Existing scripts also run through npm.

- `npm run dev`
- `npm run lint`
- `npm run typecheck`
- `npm run test:run`
- `npm run test:integration` (requires a deliberately selected Supabase target)
- Focused server tests can use `npm run test:run -- --environment=node --pool=threads --maxWorkers=1 <test paths>`. `BookingDrawer.test.tsx` declares its own jsdom environment.
- `src/lib/gcal/pushSync.ts`: Calendar push/delete identity and idempotence.
- `src/lib/actions/admin/cancelSeries.ts`: per-occurrence cancellation and delivery warnings.
- `src/components/admin/BookingDrawer.tsx`: mixed-outcome display.
- `src/app/admin/bookings/page.tsx`: responsive booking cards, GET filters, empty/error states.
- `src/components/admin/BookingDeliveryActions.tsx`: expandable recovery controls and delivery feedback.
- `src/app/api/cron/reminder/route.ts`: claimed reminder delivery.
- `supabase/migrations/20261105130530_use_vault_for_scheduled_jobs.sql`: scheduled endpoint configuration.
- `supabase/migrations/20261105134109_harden_database_execution.sql`: schedule guards and execution hardening.

The two November 5 operational migrations were executed against production during this session. Inspect remote migration history and deployed objects before applying them again; a successful manual SQL execution alone does not establish a migration-history entry.
