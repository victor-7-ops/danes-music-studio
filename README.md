# Danes Music Studio — Booking App

## What this is

Rehearsal room booking system for Danes Music Studio, Pardo, Cebu City. Customers book online, pay a deposit via PayMongo GCash, and receive a confirmation email. Admin manages the calendar at `/admin`. Rate: ₱350/hr, available 9AM–10PM.

## Stack

Next.js 14 · Supabase · PayMongo · Resend · Vercel

---

## Local Setup

### 1. Prerequisites

- Node.js 18+
- pnpm (`npm install -g pnpm`)
- Supabase account + project
- PayMongo account (test mode)
- Resend account

### 2. Clone and install

```bash
git clone https://github.com/<your-org>/danes.git
cd danes
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
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Dashboard → Project Settings → API → anon/public key |
| `PAYMONGO_SECRET_KEY` | PayMongo Dashboard → Developers → API Keys → Secret Key |
| `PAYMONGO_WEBHOOK_SECRET` | PayMongo Dashboard → Developers → Webhooks (set after registering webhook) |
| `NEXT_PUBLIC_URL` | `http://localhost:3000` for local dev |
| `RESEND_API_KEY` | Resend Dashboard → API Keys |
| `RESEND_FROM_EMAIL` | Verified sender address in Resend (e.g. `noreply@yourdomain.com`) |
| `CRON_SECRET` | Any random string — secures `/api/cron/expire-holds` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → service_role secret (**LOCAL ONLY — do NOT add to Vercel**) |

> **Important:** The env var name is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — **not** `NEXT_PUBLIC_SUPABASE_ANON_KEY`. If your `.env.example` shows `ANON_KEY`, rename it to `PUBLISHABLE_KEY` to match the code.

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
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | (anon/public key from Supabase Dashboard → Project Settings → API) |
| `PAYMONGO_SECRET_KEY` | `sk_live_xxxx` (from PayMongo Dashboard → Developers → API Keys) |
| `PAYMONGO_WEBHOOK_SECRET` | (set after Step 4 below) |
| `NEXT_PUBLIC_URL` | `https://<project>.vercel.app` |
| `RESEND_API_KEY` | (from Resend Dashboard → API Keys) |
| `RESEND_FROM_EMAIL` | (verified sender address in Resend) |
| `CRON_SECRET` | (any random secret string — use a password generator) |

**Do NOT add `SUPABASE_SERVICE_ROLE_KEY` to Vercel** — it is for local seed only and must not be deployed.

### Step 4 — Register PayMongo webhook

1. PayMongo Dashboard → **Developers** → **Webhooks** → **Add Endpoint**
2. URL: `https://<project>.vercel.app/api/webhooks/paymongo`
3. Events to subscribe: `payment.paid`, `payment.failed`
4. Save the endpoint — copy the generated **webhook secret**
5. Add it as `PAYMONGO_WEBHOOK_SECRET` in your Vercel environment variables

### Step 5 — Redeploy

Trigger a new Vercel deployment so `PAYMONGO_WEBHOOK_SECRET` takes effect:

Vercel Dashboard → Project → **Deployments** → **Redeploy** the latest deployment.

### Step 6 — Create studio-photos storage bucket

1. Supabase Dashboard → **Storage** → **New Bucket**
2. Name: `studio-photos`
3. Public: **ON**
4. Upload studio photos directly via the Supabase Dashboard — they appear on the landing page automatically

### Step 7 — Smoke test

1. Visit `https://<project>.vercel.app` → landing page loads with studio photos
2. Click **Book Now** → complete the booking flow → reach PayMongo GCash checkout
3. Use PayMongo test credentials to complete payment
4. Verify the confirmation email arrives at the address you entered
5. Log in to `/admin` → verify the booking appears in the calendar

---

## Admin

`/admin` — Supabase Auth login. Single owner account. Create the admin user via Supabase Dashboard → Authentication → Users → **Add User**.

---

## Environment variable quick reference

| Variable | Required in | Notes |
|----------|-------------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Local + Vercel | Project URL from Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Local + Vercel | anon/public key — **not ANON_KEY** |
| `PAYMONGO_SECRET_KEY` | Local + Vercel | Use test key locally, live key on Vercel |
| `PAYMONGO_WEBHOOK_SECRET` | Local + Vercel | From webhook registration |
| `NEXT_PUBLIC_URL` | Local + Vercel | Full origin URL including protocol |
| `RESEND_API_KEY` | Local + Vercel | From Resend dashboard |
| `RESEND_FROM_EMAIL` | Local + Vercel | Verified sender domain in Resend |
| `CRON_SECRET` | Local + Vercel | Arbitrary secret string |
| `SUPABASE_SERVICE_ROLE_KEY` | Local only | Seed script — **never deploy** |
