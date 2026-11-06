# Danes Music Studio — Booking App

For current implementation status, deployment evidence, pending work, and project decisions, start with [HANDOFF.md](HANDOFF.md). Keep that handoff updated when work changes; [CLAUDE.md](CLAUDE.md) contains the pickup and continuity rules.

## What this is

Rehearsal room booking system for Danes Music Studio, Pardo, Cebu City. Customers book online, then pay a deposit by scanning a GCash QR code or via bank transfer and uploading a screenshot as proof of payment. Once admin verifies the payment in `/admin`, the booking is confirmed and a confirmation email is sent. Rate: ₱350/hr, available 9AM–10PM.

## Stack

Next.js 14 · Supabase · Resend · Vercel

> PayMongo integration code exists in the repo (`src/lib/paymongo.ts`, the webhook route at `src/app/api/webhooks/paymongo`) but is currently unwired by design — see `HANDOFF.md`. The manual QR/bank-transfer + proof-upload flow described above is the only active payment path; do not follow PayMongo-specific setup unless re-enabling it.

---

## Local Setup

### 1. Prerequisites

- Node.js 22.14.x
- pnpm (`npm install -g pnpm`)
- Supabase account + project
- Resend account

### 2. Clone and install

```bash
git clone https://github.com/victor-7-ops/danes-music-studio.git
cd danes-music-studio
pnpm install
```

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

Required for local dev:

| Variable | Where to get it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Dashboard → API keys → publishable key |
| `NEXT_PUBLIC_URL` | `http://localhost:3000` for local dev |
| `RESEND_API_KEY` | Resend Dashboard → API Keys |
| `RESEND_FROM_EMAIL` | Verified sender address in Resend (e.g. `noreply@yourdomain.com`) |
| `CRON_SECRET` | Any random secret string — secures cron routes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → service_role secret (private server variable; never prefix with `NEXT_PUBLIC_`) |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | 32 random bytes encoded as 64 hex characters; encrypts the stored Google Calendar refresh token |

> **Important:** The env var name is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — **not** `NEXT_PUBLIC_SUPABASE_ANON_KEY`. If your `.env.example` shows `ANON_KEY`, rename it to `PUBLISHABLE_KEY` to match the code.

> `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` are **not required** for local dev — PayMongo integration exists in code but is intentionally unwired. Leave them unset unless you're specifically working on re-enabling PayMongo.

### 4. Database setup

Run Supabase migrations (if using local Supabase CLI):

```bash
supabase db push
```

Or apply migrations manually via the Supabase Dashboard SQL editor.

### 5. Run locally

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 6. Seed demo data (optional)

```bash
pnpm seed
```

Creates 3 sample bookings (pending, confirmed, completed) so the admin calendar is not empty on first run. Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`.

Running `pnpm seed` twice is safe — it uses upsert on `confirmation_code` so it will not duplicate rows.

---

## Deploy to Vercel

### Step 1 — Push to GitHub

Ensure the repo is pushed to GitHub.

### Step 2 — Connect to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard) → **Add New Project**
2. Import your GitHub repository (`danes`)
3. Accept default build settings — Next.js is auto-detected
4. Click **Deploy**
5. Note your assigned URL: `https://<project>.vercel.app`

### Step 3 — Set environment variables in Vercel

Vercel Dashboard → Project → **Settings** → **Environment Variables**. Add ALL of the following:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | (from Supabase Dashboard → Project Settings → API) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | (publishable key from Supabase Dashboard → API keys) |
| `NEXT_PUBLIC_URL` | `https://<project>.vercel.app` |
| `RESEND_API_KEY` | (from Resend Dashboard → API Keys) |
| `RESEND_FROM_EMAIL` | (verified sender address in Resend) |
| `CRON_SECRET` | (any random secret string — use a password generator) |
| `SUPABASE_SERVICE_ROLE_KEY` | (private server variable required for booking transactions, customer capability reads, proof uploads, and reminders) |
| `GOOGLE_TOKEN_ENCRYPTION_KEY` | (64 hex chars from `openssl rand -hex 32`) |

Set `SUPABASE_SERVICE_ROLE_KEY` as a **private server environment variable** in Vercel. Never name it `NEXT_PUBLIC_*`, expose it to client bundles, or log it. The server uses it only behind capability checks, the cron secret, or authenticated admin checks. Set `GOOGLE_TOKEN_ENCRYPTION_KEY` as a private server variable too; production startup validates its format, and the Google Calendar crypto module requires it when server code loads.

> `PAYMONGO_SECRET_KEY` and `PAYMONGO_WEBHOOK_SECRET` are **not currently required** — PayMongo integration exists in code but is intentionally unwired (the live payment path is manual GCash QR/bank-transfer + proof upload). Keep these unset unless you're specifically re-enabling PayMongo; there is no webhook to register for a working deploy.

### Step 4 — Configure GCash QR / bank details

1. Log in to `/admin` → **Settings**
2. Upload a GCash QR code image and/or enter bank transfer details
3. These are shown to customers on the payment page (`/book/pay`) after they submit a booking

### Step 5 — Create studio-photos storage bucket

1. Supabase Dashboard → **Storage** → **New Bucket**
2. Name: `studio-photos`
3. Public: **ON**
4. Upload studio photos directly via the Supabase Dashboard — they appear on the landing page automatically

### Step 6 — Smoke test

1. Visit `https://<project>.vercel.app` → landing page loads with studio photos
2. Click **Book Now** → complete the booking form → you're redirected to `/book/pay?code=...` showing the GCash QR code / bank details and the amount due
3. Upload a payment screenshot via **Submit Proof** → you're redirected to `/book/confirm?code=...&proof=uploaded`
4. Log in to `/admin` → open the pending booking → confirm the deposit (`confirmDeposit`) → verify the booking status changes to confirmed
5. Verify the confirmation email arrives at the address you entered during booking

---

## Admin

`/admin` — Supabase Auth login. Public signup is disabled. Create the owner account from Supabase Dashboard → Authentication → Users → **Add User**, then assign the trusted role in the SQL editor:

```sql
UPDATE auth.users
SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
WHERE id = '<owner-user-uuid>';
```

Use `raw_app_meta_data` only. The app ignores user-editable `raw_user_meta_data`. After changing the role, sign out and sign in again (or refresh the session) so the JWT includes the new `app_metadata.role` claim. Provision exactly the intended owner account; do not grant admin through user metadata.

Before deploying the access-control migration, inspect live table grants, RLS policies, auth signup settings, and any exposed booking capabilities. The migration revokes anonymous booking reads/writes and replaces permissive admin policies. Rotate customer cancel tokens if an earlier deployment exposed them.

---

## Environment variable quick reference

| Variable | Required in | Notes |
|----------|-------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Local + Vercel | Project URL from Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Local + Vercel | Public publishable key; use this environment variable name |
| `NEXT_PUBLIC_URL` | Local + Vercel | Full origin URL including protocol |
| `RESEND_API_KEY` | Local + Vercel | From Resend dashboard |
| `RESEND_FROM_EMAIL` | Local + Vercel | Verified sender domain in Resend |
| `CRON_SECRET` | Local + Vercel | Arbitrary secret string |
| `SUPABASE_SERVICE_ROLE_KEY` | Local + Vercel server runtime | Required for trusted server routes; private secret, never expose to browser |
| `PAYMONGO_SECRET_KEY` | Not required | PayMongo integration exists in code but is intentionally unwired — keep unset unless re-enabling it |
| `PAYMONGO_WEBHOOK_SECRET` | Not required | Same as above — no webhook to register for the active (manual QR/bank-transfer) payment path |
