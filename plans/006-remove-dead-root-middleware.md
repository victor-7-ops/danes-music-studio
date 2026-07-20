# Plan 006: Remove dead root `middleware.ts`, keep `src/middleware.ts` as the single source of truth

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7879781..HEAD -- middleware.ts src/middleware.ts`
> If either file changed since this plan was written, compare against the
> excerpts below before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `7879781`, 2026-07-13

## Why this matters

Two `middleware.ts` files exist: a no-op root `middleware.ts` that only touches cookies, and `src/middleware.ts`, which actually gates `/admin/*` behind Supabase auth and sets the `x-pathname` header that `src/app/admin/layout.tsx` depends on. Verified via `.next/server/middleware-manifest.json` after a production build: Next.js resolves and compiles `src/middleware.ts` (`"name": "src/middleware"`) — the root file is dead code, currently ignored. Admin auth gating IS live today. But having two files with the same special filename, one dead and one load-bearing for security, is a landmine: a future contributor could "clean up" by deleting the wrong one (the actively-working `src/middleware.ts`) thinking the root one is the real one, silently removing the `/admin/*` auth gate. This plan removes the dead file so there's exactly one middleware, unambiguously.

## Current state

- `middleware.ts` (project root) — full file, dead code (confirmed via build manifest, not just static reading):
  ```ts
  import { type NextRequest } from 'next/server'
  import { createClient } from '@/utils/supabase/middleware'

  export async function middleware(request: NextRequest) {
    return createClient(request)
  }

  export const config = {
    matcher: [
      '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
  }
  ```
  Note it imports from `@/utils/supabase/middleware` — check whether that module is used ONLY by this dead file (if so, it's also dead and should be removed in Step 2) or whether anything else imports it.
- `src/middleware.ts` — full file, the live one:
  ```ts
  import { createServerClient } from '@supabase/ssr'
  import { NextResponse, type NextRequest } from 'next/server'

  export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    const isAdminPath = request.nextUrl.pathname.startsWith('/admin')
    const isLoginPage = request.nextUrl.pathname === '/admin/login'

    if (isAdminPath && !isLoginPage && !user) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
    if (isLoginPage && user) {
      return NextResponse.redirect(new URL('/admin', request.url))
    }

    supabaseResponse.headers.set('x-pathname', request.nextUrl.pathname)
    return supabaseResponse
  }

  export const config = {
    matcher: ['/admin/:path*'],
  }
  ```
  This file is correct and must NOT be deleted or modified — it's the target state.
- Verified fact: `.next/server/middleware-manifest.json` after `next build` shows `"name": "src/middleware"` under the `/` middleware entry — this is direct evidence, not inference, that Next.js picks `src/middleware.ts` when both exist.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Build     | `pnpm build`               | exit 0              |
| Lint      | `pnpm lint`               | exit 0              |
| Tests     | `pnpm test:run`           | all pass            |

## Scope

**In scope**:
- Delete `middleware.ts` (project root).
- `src/utils/supabase/middleware.ts` (or wherever `@/utils/supabase/middleware` resolves) — delete ONLY if Step 1 confirms nothing else imports it.

**Out of scope**:
- `src/middleware.ts` — do not touch, this is the correct, live file.
- Any other file under `src/utils/supabase/` unless it's the exact file confirmed dead in Step 1.
- `src/app/admin/layout.tsx` — unaffected, its `x-pathname` header dependency continues to be satisfied by `src/middleware.ts`.

## Git workflow

- Branch: `advisor/006-remove-dead-middleware`
- Commit per step; message style matches `git log` (e.g. `chore: remove dead root middleware.ts, keep src/middleware.ts`)
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Confirm nothing besides the dead root `middleware.ts` imports `@/utils/supabase/middleware`

```
grep -rn "utils/supabase/middleware" src/ middleware.ts
```

**Verify**: the only match should be the `import` line inside the root `middleware.ts` itself. If anything else imports it, STOP per the conditions below — don't delete a module something else depends on.

### Step 2: Delete the dead root `middleware.ts`

```
rm middleware.ts
```

(Or use the file-deletion equivalent available in your environment — this is a plain file removal, not a git operation yet.)

**Verify**: `ls middleware.ts` → "No such file or directory". `ls src/middleware.ts` → still exists.

### Step 3: Delete the now-orphaned `@/utils/supabase/middleware` module (only if Step 1 confirmed it's unused elsewhere)

If Step 1 found no other importers, delete that file too (find its exact path first: `find src/utils/supabase -iname "middleware.ts"` or equivalent).

**Verify**: `grep -rn "utils/supabase/middleware" src/` → no matches remain anywhere in the codebase.

### Step 4: Rebuild and confirm `src/middleware.ts` is still the one compiled

```
rm -rf .next
pnpm build
```

Then inspect `.next/server/middleware-manifest.json`.

**Verify**: the build succeeds (exit 0) and `middleware-manifest.json` still shows `"name": "src/middleware"` with the `/admin/:path*` matcher — i.e., removing the dead file didn't accidentally change which middleware is active or break the matcher config.

## Test plan

No unit test covers middleware directly (Next.js middleware is typically tested via integration/e2e, which this repo doesn't have set up for this layer). Verification is the build-manifest check in Step 4 plus a manual smoke test:

1. `pnpm dev`.
2. Open a private/incognito browser window, visit `/admin` directly (no session) → confirm redirect to `/admin/login`.
3. Log in via `/admin/login` → confirm redirect to `/admin` (not stuck on the login page).
4. Visit `/admin/login` again while still logged in → confirm redirect to `/admin` (the `isLoginPage && user` branch).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm build` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `ls middleware.ts` fails ("No such file")
- [ ] `.next/server/middleware-manifest.json` after rebuild still shows `"name": "src/middleware"` and matcher `/admin/:path*`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated
- [ ] Manual smoke test steps 1-4 above completed and confirmed working

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts (drift since this plan was written) — in particular, if either middleware file's content has changed, re-verify which one Next.js actually compiles (repeat the build-manifest check) before assuming this plan's premise still holds.
- Step 1's grep finds another importer of `@/utils/supabase/middleware` — do not delete that module; only remove the root `middleware.ts` in that case, and note the orphaned-but-still-used module in your report.
- After Step 4's rebuild, the manifest shows something OTHER than `"name": "src/middleware"` (e.g. if Next.js's file-resolution behavior differs from what was verified at plan-writing time, possibly due to a Next.js version change) — this would mean deleting the root file actually changes runtime behavior, which contradicts this plan's premise. Stop immediately, do not proceed, and report the exact manifest contents observed.

## Maintenance notes

- This confirms Next.js middleware resolution behavior empirically (via the build manifest) rather than assuming it from documentation — if the project ever changes its `src/` directory structure or Next.js major version, re-verify this assumption before trusting it again.
- A reviewer should re-run the manual smoke test (Steps in "Test plan") personally before approving, since this touches the security-critical admin auth gate, even though the change itself is a deletion of dead code.
