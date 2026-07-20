# Plan 001: Add CSRF `state` protection and admin-session check to Google Calendar OAuth callback

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7879781..HEAD -- src/lib/gcal/client.ts src/app/api/auth/google/callback/route.ts src/lib/actions/admin/connectGoogleCalendar.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `7879781`, 2026-07-13

## Why this matters

`connectGoogleCalendar` builds a Google OAuth URL with no `state` parameter, and the callback route (`/api/auth/google/callback`) accepts any `code` that lands on it with no check that the request session is an authenticated admin. Google OAuth `client_id`/`redirect_uri` are not secrets — anyone can initiate their own consent flow against this app's registered redirect URI. Without a `state` binding the callback to the admin session that started the flow, and without a session check in the callback itself, an attacker can get their own Google account's refresh token stored as the site's calendar connection, silently replacing the real one and rerouting all future push/pull sync. Fixing this closes the gap with two additive checks — no behavior change to the legitimate flow.

## Current state

- `src/lib/actions/admin/connectGoogleCalendar.ts` — server action, already checks `user` via `supabase.auth.getUser()` before redirecting to Google, but builds the URL with no CSRF binding:
  ```ts
  export async function connectGoogleCalendar(): Promise<never> {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect('/admin/login')

    const oauth2Client = createOAuth2Client()
    const url = generateAuthUrl(oauth2Client)
    redirect(url)
  }
  ```
- `src/lib/gcal/client.ts:22-28` — `generateAuthUrl` takes no `state` param:
  ```ts
  export function generateAuthUrl(oauth2Client: ReturnType<typeof createOAuth2Client>): string {
    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar.events'],
      prompt: 'consent',
    })
  }
  ```
- `src/app/api/auth/google/callback/route.ts:1-68` — full file. No `state` verification, no `supabase.auth.getUser()` call anywhere. Line 7-9 pulls only `code` from the query string. The rest of the file (token exchange, DB upsert into `google_tokens`, watch channel registration) can stay unchanged.
- Convention: this codebase uses `crypto.randomUUID()` elsewhere for tokens (see `src/lib/actions/admin/createWalkIn.ts:69`, `confirmation_code` generation) — reuse that pattern for the CSRF token rather than adding a new dependency.
- Cookies in this app are set via the `@supabase/ssr` cookie adapter pattern (see `src/middleware.ts:6-25`) but this is a simple one-off cookie, not a Supabase session cookie — use Next.js's `cookies()` API from `next/headers` directly, which is already available (Next 14 App Router).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `pnpm install`           | exit 0              |
| Typecheck | `npx tsc --noEmit`       | exit 0, no errors   |
| Lint      | `pnpm lint`               | exit 0, "No issues found" |
| Tests     | `pnpm test:run`           | all pass            |

## Scope

**In scope**:
- `src/lib/gcal/client.ts` — `generateAuthUrl` signature
- `src/lib/actions/admin/connectGoogleCalendar.ts` — generate + store `state`
- `src/app/api/auth/google/callback/route.ts` — verify `state` + admin session

**Out of scope**:
- `disconnectGoogleCalendar.ts`, `syncGoogleCalendar.ts` — unaffected, don't touch.
- Watch channel registration logic (lines 41-61 of the callback route) — leave as-is.
- Any change to the `google_tokens` table schema.

## Git workflow

- Branch: `advisor/001-gcal-oauth-csrf`
- Commit per step; message style matches `git log` (conventional-ish, lowercase, imperative: e.g. `fix: add CSRF state check to Google OAuth callback`)
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Add `state` param support to `generateAuthUrl`

In `src/lib/gcal/client.ts`, change the signature to accept a `state` string and pass it through:

```ts
export function generateAuthUrl(
  oauth2Client: ReturnType<typeof createOAuth2Client>,
  state: string
): string {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    prompt: 'consent',
    state,
  })
}
```

**Verify**: `npx tsc --noEmit` → fails at this point (call site not updated yet) — expected, continue to Step 2.

### Step 2: Generate and store the CSRF token in `connectGoogleCalendar`

In `src/lib/actions/admin/connectGoogleCalendar.ts`, generate a random token, store it in an httpOnly cookie, and pass it as `state`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createOAuth2Client, generateAuthUrl } from '@/lib/gcal/client'

export async function connectGoogleCalendar(): Promise<never> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/admin/login')

  const state = randomUUID()
  const cookieStore = await cookies()
  cookieStore.set('gcal_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes — OAuth consent flow should complete quickly
    path: '/',
  })

  const oauth2Client = createOAuth2Client()
  const url = generateAuthUrl(oauth2Client, state)
  redirect(url)
}
```

**Verify**: `npx tsc --noEmit` → still fails (callback route not updated) — expected, continue to Step 3.

### Step 3: Verify `state` and admin session in the callback route

In `src/app/api/auth/google/callback/route.ts`, add imports for `cookies` and the Supabase server client's `getUser`, and add checks before the token exchange:

```ts
export const runtime = 'nodejs'

import { cookies } from 'next/headers'
import { createOAuth2Client, registerWatchChannel } from '@/lib/gcal/client'
import { encryptToken } from '@/lib/gcal/crypto'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.redirect(new URL('/admin/login', request.url))
  }

  const cookieStore = await cookies()
  const expectedState = cookieStore.get('gcal_oauth_state')?.value
  cookieStore.delete('gcal_oauth_state')

  if (!state || !expectedState || state !== expectedState) {
    console.error('[gcal:callback] state mismatch — possible CSRF attempt')
    return Response.redirect(new URL('/admin/settings?gcal=error_state_mismatch', request.url))
  }

  if (!code) {
    return Response.redirect(new URL('/admin/settings?gcal=error', request.url))
  }

  try {
    // ... rest of the function body unchanged from here
```

Keep the rest of the `try` block (token exchange, `google_tokens` upsert, watch channel registration, final redirect, `catch` block) exactly as it is today — only the preamble above the `try` changes. Do not duplicate the `createClient()` call inside the `try` block; reuse the `supabase` variable already created above.

**Verify**: `npx tsc --noEmit` → exit 0, no errors.

## Test plan

No existing test file covers this route or `connectGoogleCalendar` (there is no `src/lib/gcal/__tests__` or `src/lib/actions/admin/__tests__` directory — confirmed absent). Adding a full integration test here requires mocking Next's `cookies()` and the Google OAuth SDK, which is disproportionate effort for this plan's scope. Skip adding automated tests; instead do a manual verification:

1. `pnpm dev`, log in to `/admin`, go to `/admin/settings`, click "Connect Google Calendar".
2. Confirm you land on Google's consent screen, complete it, and land back on `/admin/settings?gcal=connected`.
3. Manually hit the callback URL directly with a bogus `state` (e.g. copy the real callback URL from step 2's browser history, change the `state` query param to `bogus`, and load it while logged in) — confirm it redirects to `/admin/settings?gcal=error_state_mismatch` and does NOT touch the `google_tokens` row (check via Supabase dashboard or `select * from google_tokens` — `updated_at` unchanged).
4. Log out of `/admin`, hit `/api/auth/google/callback?code=anything&state=anything` directly — confirm redirect to `/admin/login`.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:run` exits 0 (no regressions)
- [ ] `grep -n "state" src/app/api/auth/google/callback/route.ts` shows the state-check block
- [ ] `grep -n "getUser" src/app/api/auth/google/callback/route.ts` shows the admin-session check
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated
- [ ] Manual verification steps 1-4 above completed and confirmed working

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts (drift since this plan was written).
- `oauth2Client.generateAuthUrl` in the `googleapis` SDK doesn't accept a `state` field (check the installed `googleapis` version's types if `tsc` errors on this specifically) — report the actual SDK signature found.
- The fix appears to require touching `disconnectGoogleCalendar.ts` or `syncGoogleCalendar.ts`.

## Maintenance notes

- If a future feature needs the OAuth flow to redirect to something other than `/admin/settings`, thread that through the `state` value (e.g. JSON-encode `{token, returnTo}`) rather than adding a second cookie.
- Any reviewer should confirm the cookie's `maxAge` (600s) is generous enough for a real user to complete Google's consent screen without hitting `error_state_mismatch` on a valid attempt — if false positives are reported in practice, increase the maxAge, not remove the check.
