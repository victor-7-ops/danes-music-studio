# Plan 010a: Upgrade Next.js 14 → 15 (and React 18 → 19, coupled — see note below)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 2dcd821..HEAD -- package.json pnpm-lock.yaml`
> If `next`, `react`, `react-dom`, `eslint-config-next`, `@types/react`, or
> `@types/react-dom` versions changed since this plan was written, re-run
> `pnpm outdated` fresh and compare against the "Current state" section below
> before proceeding; on a material mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (framework + rendering-library major bump together, on a booking app with money and timezone-sensitive logic — mitigated by CI safety net and this plan's staged verification)
- **Depends on**: plan 004 (CI pipeline) — already DONE at commit `2e044df`, so this plan is unblocked
- **Category**: migration
- **Planned at**: commit `2dcd821`, 2026-07-21

## Why this matters

Next 14.2.35 is losing security-patch cadence as the ecosystem moves to 15/16. This app handles real payments (PayMongo) and timezone-sensitive booking/availability logic, so upgrades need a staged, verifiable path rather than a single large jump. This plan scopes ONLY the Next 14→15 hop.

**Important correction to plan 010's default assumption**: plan 010 assumed Next 15 could stay on React 18, decoupling the Next and React upgrades. Live research against the official Next.js upgrade guide (fetched 2026-07-21, `https://nextjs.org/docs/app/guides/upgrading/version-15`) shows this is **false**: *"The minimum versions of `react` and `react-dom` is now 19."* Next 15 does not support React 18. This plan therefore scopes Next 14→15 **and** React 18→19 together, as a single coupled hop — Tailwind stays on v3 and ESLint stays on v8, keeping those two variables isolated as plan 010 intended. This finding should inform 010b's scoping: there's no version of the plan where Next and React majors move independently.

The risk is still bounded: this codebase already writes `params`/`searchParams` as `Promise<...>` types and already does `await cookies()` / `await headers()` in the files that use them (see Current state) — i.e. it's already written in the async-request-API style Next 15 requires. The main remaining surface is the React 19 bump itself and the `fetch`/route-handler caching default change.

## Current state

- `package.json` dependencies relevant to this hop:
  ```json
  "dependencies": {
    "next": "14.2.35",
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "eslint-config-next": "14.2.35",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5",
    "eslint": "^8",
    "tailwindcss": "^3.4.1"
  }
  ```
  Fresh `pnpm outdated` (run 2026-07-21) confirms: `next: 14.2.35 → 16.2.10` (target 15.x, not latest — see Step 1), `react`/`react-dom`: `18.3.1 → 19.2.7`, `eslint-config-next: 14.2.35 → 16.2.10`, `@types/react: 18.3.31 → 19.2.17`, `@types/react-dom: 18.3.7 → 19.2.3`.
- Node.js runtime in the dev environment: `v24.15.0` — comfortably above Next 15's minimum (Node 18.18+); no Node upgrade needed for this hop.
- `src/middleware.ts` (NOT root `middleware.ts` — plan 006 already deleted the dead root duplicate) — uses `NextResponse`, `NextRequest` from `next/server`, gates `/admin/:path*`. Does not use `request.geo` or `request.ip` (the two `NextRequest` properties removed in Next 15) — confirmed via `grep -n "\.geo\|\.ip" src/middleware.ts` returning no matches at plan time.
- Dynamic route pages already use the Next-15-style async `params`:
  - `src/app/booking/[code]/page.tsx:12` — `params: Promise<{ code: string }>`, `:23` — `const { code } = await params`
  - `src/app/booking/[code]/cancel-confirm/page.tsx:11,16` — same pattern
  - `src/app/booking/[code]/reschedule-confirm/page.tsx:11,16` — same pattern
- `cookies()`/`headers()` usage already async-awaited (no sync-access codemod needed):
  - `src/app/admin/layout.tsx:11` — `await headers()`
  - `src/app/api/auth/google/callback/route.ts:21` — `await cookies()`
  - `src/lib/actions/admin/connectGoogleCalendar.ts:17` — `await cookies()`
  - `src/lib/supabase/server.ts:5` — `await cookies()`
- `fetch()` call sites to re-check against Next 15's "no longer cached by default" change (this is a relaxation of caching, not a new failure mode, but confirm no code relies on the old implicit caching):
  - `src/app/book/slots/page.tsx:35` — `fetch(`${baseUrl}/api/availability?date=${date}`, ...)` — availability data; must NOT be stale-cached, so the new default (uncached) is actually safer here. Read the surrounding code to confirm no explicit `{ cache: 'force-cache' }` was relied upon.
  - `src/lib/supabase/serviceClient.ts:19` — already explicit `cache: 'no-store'`, unaffected.
  - `src/lib/paymongo.ts:38`, `src/lib/telegram.ts:9` — outbound API calls, not App Router data fetches; unaffected by the Next fetch-cache default.
  - `src/components/booking/PaymentProofUpload.tsx:26` — client-side `fetch`, unaffected (the caching default change only applies to server-side `fetch` in Server Components/Route Handlers).
- Route handlers (10 total, `find src/app -iname route.ts`): `api/auth/google/callback`, `api/availability`, `api/booking/cancel`, `api/booking/reschedule`, `api/bookings/proof`, `api/cron/gcal-pull`, `api/cron/gcal-renew`, `api/cron/reminder`, `api/webhooks/google-calendar`, `api/webhooks/paymongo`. None currently declare `export const dynamic = 'force-static'` or rely on `GET` caching (`grep -rn "export const dynamic\|export const revalidate" src/app/api` returns no matches) — Next 15's "GET no longer cached by default" change is a no-op for this app since nothing opted into GET caching.
- `.eslintrc.json`: `{"extends": ["next/core-web-vitals", "next/typescript", "prettier"]}` — stays untouched this hop; `eslint-config-next` gets bumped in lockstep with `next` per plan 010's note, but ESLint itself (currently `^8`) stays on 8, and `eslint-config-next` 15.x is confirmed to still support the legacy `.eslintrc` format (flat-config-by-default only lands in `eslint-config-next` 16, per the Next 16 upgrade guide's "ESLint Flat Config" section).
- `tailwind.config.ts` and `postcss.config.mjs` are untouched this hop (Tailwind stays on `^3.4.1`).

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `pnpm install`           | exit 0              |
| Typecheck | `pnpm typecheck`         | exit 0, no errors   |
| Lint      | `pnpm lint`              | exit 0               |
| Unit tests | `pnpm test:run`          | all pass             |
| Integration tests | `pnpm test:integration` | all pass       |
| Build     | `pnpm build`              | exit 0, no errors    |
| Dev server (manual walkthrough) | `pnpm dev` | starts on localhost, no console errors on the pages listed in Step 6 |

## Suggested executor toolkit

- Reference docs read during this plan's spike, worth re-reading if something breaks: `https://nextjs.org/docs/app/guides/upgrading/version-15` (Next 14→15 guide), `https://react.dev/blog/2024/04/25/react-19-upgrade-guide` (React 19 upgrade guide).
- If TypeScript errors appear after the bump that look like React 19 JSX/type changes (e.g. `ReactNode` type narrowing, `useRef` requiring an argument), consult the React 19 upgrade guide's "TypeScript changes" section before improvising fixes.

## Scope

**In scope**:
- `package.json` — bump `next`, `react`, `react-dom`, `eslint-config-next`, `@types/react`, `@types/react-dom` to their Next-15-compatible versions.
- `pnpm-lock.yaml` — regenerated by `pnpm install`.
- Any application source file the codemod or the resulting typecheck/build errors touch, strictly to satisfy the Next 15 / React 19 API surface (async APIs, removed `NextRequest.geo`/`.ip`, React 19 type changes) — do not use this as an opportunity to refactor unrelated code.

**Out of scope** (do NOT touch, even though they look related):
- `tailwindcss`, `eslint` (core package), `typescript` — stay on their current majors this hop.
- `tailwind.config.ts`, `postcss.config.mjs`, `.eslintrc.json` — no structural changes needed for this hop.
- Any Next 16-specific change (Turbopack-by-default, `middleware` → `proxy` rename, `next lint` removal, image config defaults) — that's plan 010b's scope, not this one. If the codemod offers to apply Next 16 changes, decline/skip them.
- `googleapis`, `date-fns`, `resend`, `@supabase/*`, `react-big-calendar`, `react-day-picker` — unrelated dependencies, not in scope for this hop even if `pnpm outdated` shows them as outdated too.

## Git workflow

- Branch: `upgrade/010a-next-15` (repo has no strongly established feature-branch convention observed in `git log`; this name follows the plan-numbering convention used elsewhere)
- Commit per step or per logical unit. This repo's commit style (from `git log`): short imperative subject with a `type:` prefix, e.g. `fix: restore mobile viewport, close equipment double-booking race, harden money actions`, `feat: redesign admin settings payment section...`. Use `chore:` or `fix:` prefixes as appropriate (e.g. `chore: upgrade Next.js 14→15 and React 18→19`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Confirm target versions and run the codemod

Run `pnpm outdated` fresh to get exact target versions (do not assume the numbers in "Current state" are still current — they were captured 2026-07-21). Target the **15.x** line specifically, not `latest` (which may now point to 16.x) — pin explicitly:

```bash
pnpm dlx @next/codemod@canary upgrade 15.5.4
```

(Substitute `15.5.4` with the actual latest 15.x patch found via `npm view next versions --json | grep '"15\.'` or equivalent, if it differs.) If the codemod prompts for confirmation on individual transforms, review each one against this plan's "Current state" section (most should be no-ops here since the codebase is already written in the async-API style) before accepting.

If the codemod is unavailable or fails, fall back to the manual install:
```bash
pnpm add next@15 react@19 react-dom@19 eslint-config-next@15
pnpm add -D @types/react@19 @types/react-dom@19
```

**Verify**: `cat package.json | grep -E '"next"|"react"|"react-dom"|"eslint-config-next"'` shows `next` and `eslint-config-next` on a `15.x` version and `react`/`react-dom` on `19.x`.

### Step 2: Install and resolve peer-dependency warnings

Run `pnpm install`. If peer-dependency warnings appear for packages expecting React 18 (check `react-big-calendar`, `react-day-picker`, `@testing-library/react` — all currently pinned to versions from the React 18 era per "Current state" above), note them but do NOT upgrade those packages as part of this plan — they're out of scope. Only escalate if `pnpm install` hard-fails (not just warns).

**Verify**: `pnpm install` exits 0. `git diff --stat -- package.json pnpm-lock.yaml` shows only the expected dependency-version changes, nothing else.

### Step 3: Fix TypeScript/build errors from the async-API and React 19 changes

Run `pnpm typecheck`. Fix errors file-by-file. Expected sources of errors, in priority order to check:
1. Any remaining sync `params`/`searchParams`/`cookies()`/`headers()` usage the codemod missed — cross-check against the file list in "Current state" (should be none, since those are already async, but verify no other route/page in `src/app` uses these APIs synchronously: `grep -rln "params\." src/app --include="*.tsx" | xargs grep -L "await params\|Promise<"`).
2. React 19 type changes — most commonly `ReactNode` no longer implicitly including `undefined`/`bigint` in some type positions, and `useRef()` now requiring an explicit initial-value argument. Fix at the call site; do not add blanket `any` casts.
3. `NextRequest.geo`/`.ip` removal — confirmed not used in `src/middleware.ts` per "Current state", but re-grep to be sure: `grep -n "\.geo\b\|\.ip\b" src/middleware.ts`.

**Verify**: `pnpm typecheck` exits 0.

### Step 4: Fix lint and build errors

Run `pnpm lint`, fix any new violations (should be minimal — ESLint config itself is unchanged this hop, only `eslint-config-next`'s Next-15-aware rules are new). Then run `pnpm build`.

**Verify**: `pnpm lint` exits 0. `pnpm build` exits 0 with no errors (warnings about the fetch caching default change are expected/informational, not failures).

### Step 5: Automated regression pass

Run `pnpm test:run` and `pnpm test:integration`.

**Verify**: both exit 0, all existing tests pass. Do not weaken or delete a failing test to make this pass — a failing test here means a real behavior change from the upgrade; fix the underlying code or, if the test's assumption is genuinely obsolete because of an intentional Next/React 15/19 behavior change, note it explicitly in the commit message.

### Step 6: Manual booking-flow regression walkthrough

Per `HANDOFF.md`'s "Verification approach for every phase" section, this project requires more than typecheck/build/tests for logic touching bookings and money. Run `pnpm dev` and manually walk through, watching the browser console for errors/warnings on each page:

1. `/` — landing page loads.
2. `/book` → `/book/slots` (confirm availability `fetch` in `src/app/book/slots/page.tsx:35` still returns slots correctly — this is the fetch-caching-default change's main risk point) → `/book/details` → `/book/review` → `/book/pay` → `/book/confirm` — full booking creation flow, at least one full run without submitting a real payment.
3. `/booking/[code]` with a real booking code from a test booking — confirm the async `params` still resolves the code correctly and the page renders (this exercises the pattern in "Current state" directly under the new Next version).
4. `/booking/[code]/cancel-confirm` and `/booking/[code]/reschedule-confirm` — same, for the other two async-`params` pages.
5. `/admin/login` → `/admin` (confirm `src/middleware.ts` auth gate still redirects correctly pre- and post-login) → `/admin/dashboard`, `/admin/bookings`, `/admin/calendar` — spot-check each renders without visible layout breakage or console errors.

**Verify**: no step above throws a rendering error, hydration mismatch warning, or console error not present before the upgrade. If any booking-flow page renders visibly differently than before (layout shift, missing data, broken interaction), treat this as the STOP condition below — do not "fix forward" past it without flagging.

## Test plan

- No new tests are required for this plan — it's a dependency-version bump, not new functionality. The existing suite (`pnpm test:run`, `pnpm test:integration`) is the regression gate, supplemented by the manual walkthrough in Step 6 because `HANDOFF.md` requires browser-level verification for money/booking logic that the automated suite doesn't fully cover (per its own "Verification approach" note).
- If Step 3's fixes touch any file under `src/lib/actions/` (money-handling Server Actions), re-run `pnpm test:run -- <that file's test>` specifically and confirm the specific test file still passes, since plan 019 established dedicated money-action test coverage that must not regress.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `package.json` shows `next` on 15.x, `react`/`react-dom` on 19.x, `eslint-config-next` on 15.x, `@types/react`/`@types/react-dom` on 19.x
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm build` exits 0
- [ ] `pnpm test:run` exits 0, no test skipped/deleted to force a pass
- [ ] `pnpm test:integration` exits 0
- [ ] Manual walkthrough (Step 6) completed with no new console errors or visible regressions on any booking-flow page
- [ ] `tailwindcss`, `eslint` (core), `typescript` versions unchanged in `package.json` (confirms scope isolation held)
- [ ] `plans/README.md` status row for 010a updated

## STOP conditions

Stop and report back (do not improvise) if:

- The codemod or manual install pulls in a Next version outside the 15.x line (e.g. it defaults to installing 16.x) — re-pin explicitly per Step 1 rather than proceeding on an unintended major.
- `pnpm typecheck` or `pnpm build` still fails after a reasonable fix attempt (roughly: you've addressed every error class listed in Step 3 and a new, unrelated-looking error class appears) — this suggests either a codebase assumption in "Current state" was wrong, or a breaking change wasn't captured by this plan's research.
- Any file outside `src/app`, `src/lib`, `src/middleware.ts`, `package.json`, `pnpm-lock.yaml` needs modification to make the upgrade work — that's a sign the blast radius is larger than scoped and needs a human decision.
- The manual walkthrough (Step 6) surfaces a visible rendering difference or broken interaction on any booking-flow or payment-adjacent page — per plan 010's own STOP-condition language, a framework upgrade that changes visible booking-flow behavior needs a human review gate before merging, not a silent "fix and continue."
- Peer-dependency resolution forces an upgrade of `react-big-calendar`, `react-day-picker`, or `@testing-library/react` to a major version — those are out of scope for this plan; if `pnpm install` cannot proceed without it, stop and report rather than pulling them in silently.

## Maintenance notes

- After this lands and is stable in production for a reasonable period, plan 010b (Next 15→16, which per Next's own upgrade guide is Turbopack-by-default, `middleware.ts`→`proxy.ts` rename, and further React 19.2/canary features) and 010c (Tailwind 3→4) should be written using the same spike-then-scope approach plan 010 used — don't skip straight to writing them now.
- A reviewer should scrutinize: (1) whether `react-big-calendar`/`react-day-picker` actually work correctly at runtime under React 19 even though they weren't upgraded (React 19 has backward-compat for most React 18 libraries, but calendar/date-picker libraries doing DOM-imperative work are a common source of subtle runtime breakage that typecheck won't catch); (2) the Step 6 manual walkthrough was actually performed, not rubber-stamped.
- `src/middleware.ts` should be renamed to `src/proxy.ts` when 010b (Next 16) lands, not before — Next 15 still supports the `middleware.ts` convention.
