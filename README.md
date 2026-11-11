# Danes Music Studio — Booking App

Rehearsal and recording room booking system for Danes Music Studio, Pardo, Cebu City. Customers book a session online, pay a deposit or the full amount via GCash QR / bank transfer, and upload a screenshot as proof of payment. Once the studio verifies the payment, the booking is confirmed, a confirmation email goes out, and the session is pushed to the studio's Google Calendar.

For the full current state of the system — architecture, security audit history, known deferrals — see [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md).

## Stack

Next.js 14 · Supabase (Postgres, Auth, Storage) · Resend (email) · Google Calendar API · Telegram Bot API · Vercel

## Features

- Public booking flow: service selection, availability/date picking, equipment add-ons, optional voucher codes, single or recurring (weekly) sessions
- Manual payment: GCash QR or bank transfer with proof-of-payment upload
- Admin dashboard: bookings, calendar, advanced/walk-in booking, maintenance closures, special hours, vouchers, settings
- Telegram alerts for new bookings, proof uploads, and payment confirmations, with inline confirm/cancel buttons wired to the same booking-action logic as the admin dashboard
- Google Calendar two-way sync (push on confirm/cancel, pull for external events/closures)
- Percent-discount voucher system with eligibility rules enforced server-side

## Local setup

### Prerequisites

- Node.js 22.x
- pnpm (`npm install -g pnpm`)
- A Supabase project
- A Resend account

### Install

```bash
git clone https://github.com/victor-7-ops/danes-music-studio.git
cd danes-music-studio
pnpm install
```

### Environment variables

Copy `.env.example` to `.env.local` and fill in every value:

```bash
cp .env.example .env.local
```

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (not the legacy anon key name) |
| `SUPABASE_SERVICE_ROLE_KEY` | Private server-only key; required for booking transactions, proof uploads, reminders — never expose to the client |
| `NEXT_PUBLIC_URL` | Full base URL of the deployment |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Transactional email |
| `CRON_SECRET` | Authorizes the reminder/calendar cron routes |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Google Calendar OAuth |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | 64 hex chars (`openssl rand -hex 32`); encrypts the stored Calendar refresh token |
| `GCAL_WEBHOOK_TOKEN` | Validates incoming Google Calendar push-notification webhooks |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Telegram alerts (no-op if unset) |
| `TELEGRAM_WEBHOOK_SECRET` | Validates incoming Telegram webhook callbacks (confirm/cancel buttons) |
| `PAYMONGO_SECRET_KEY` / `PAYMONGO_WEBHOOK_SECRET` | Not required — PayMongo is unwired by design, see `PROJECT_DOCUMENTATION.md` |

### Database

Apply migrations in `supabase/migrations/` in order, either with the Supabase CLI (`supabase db push`) or manually via the Supabase Dashboard SQL editor.

### Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Seed demo data (optional)

```bash
pnpm seed
```

Creates a handful of sample bookings so the admin calendar isn't empty on first run. Safe to run more than once. **Never run against a production database.**

## Scripts

```bash
pnpm dev             # dev server
pnpm build           # production build
pnpm lint
pnpm typecheck
pnpm test:run        # unit tests
pnpm test:integration   # requires a deliberately chosen, disposable Supabase target
```

## Admin access

`/admin` uses Supabase Auth; public signup is disabled. Create the owner account from the Supabase Dashboard (Authentication → Users → Add User), then grant the admin role via trusted app metadata:

```sql
UPDATE auth.users
SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
WHERE id = '<owner-user-uuid>';
```

Only `raw_app_meta_data` is trusted — user-editable metadata is ignored. Sign out and back in after changing the role so the session JWT picks up the new claim.

## Deployment

Deployed on Vercel. Set every environment variable above as a Vercel project environment variable, with `SUPABASE_SERVICE_ROLE_KEY` and `GOOGLE_TOKEN_ENCRYPTION_KEY` scoped as private server variables. After the first deploy, configure GCash QR / bank transfer details and service pricing from `/admin/settings`.

## Architecture notes

- All booking pricing, deposit calculation, equipment reservation, and voucher validation happen inside Postgres RPCs (`create_customer_reservations`, `create_admin_booking`) under row-level locking — never trust client-submitted totals.
- Shared booking-action logic (`src/lib/bookingOps/confirmPayment.ts`, `cancelBooking.ts`) is used by both the admin dashboard and the Telegram webhook, so both enforce identical rules.
- Money is always integer centavos. Scheduling is always Asia/Manila time.

See [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) for the full picture, including audit history and known deferred work.
