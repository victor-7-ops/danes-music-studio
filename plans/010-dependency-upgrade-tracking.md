# Plan 010: Stage a Next.js / React / Tailwind / ESLint major-version upgrade (spike, not a one-shot bump)

> **Executor instructions**: This plan is a SPIKE/TRACKING plan, not a
> ready-to-execute implementation plan like the others in this directory. Its
> "Steps" produce a scoped follow-up plan (or a "not yet worth it" verdict),
> not a merged upgrade. Read it fully before starting. If anything in the
> "STOP conditions" section occurs, stop and report — do not improvise past
> the spike's boundaries into an actual upgrade without a human decision
> point in between.
>
> **Drift check (run first)**: `git diff --stat 7879781..HEAD -- package.json`
> If dependency versions changed since this plan was written, re-run
> `pnpm outdated` fresh rather than trusting the numbers below.

## Status

- **Priority**: P3
- **Effort**: L (this spike is S; the eventual upgrade it scopes is L)
- **Risk**: HIGH if the underlying majors are bumped in one shot; this plan's job is to convert that into a staged, LOW-risk-per-step sequence
- **Depends on**: none (but should land AFTER plan 004 — CI — so the upgrade work has a safety net)
- **Category**: migration
- **Planned at**: commit `7879781`, 2026-07-13

## Why this matters

At plan-writing time, `pnpm outdated` shows: `next: 14.2.35 → 16.2.10`, `react`/`react-dom`: `18.3.1 → 19.2.7`, `typescript: 5.9.3 → 7.0.2`, `tailwindcss: 3.4.19 → 4.3.2`, `eslint: 8.57.1 → 10.7.0`. Next 14 loses security patches faster than 15/16 as the ecosystem moves on, and the gap compounds — the longer this waits, the more breaking changes accumulate across App Router APIs, React's rendering model, and Tailwind's engine, all bundled into one eventual jump. This is explicitly NOT a "bump the version and fix what breaks" task for a booking app handling real money and timezone-sensitive logic — it needs a staged approach with a real regression-testing pass at each step. This plan's deliverable is the staging plan itself, produced by a research spike, not the upgrade.

## Current state

- `package.json` dependencies at plan time (see full excerpt from recon):
  ```json
  "dependencies": {
    "@supabase/ssr": "0.12.0",
    "@supabase/supabase-js": "2.108.2",
    "date-fns": "^4.4.0",
    "googleapis": "^173.0.0",
    "next": "14.2.35",
    "react": "^18",
    "react-big-calendar": "^1.20.0",
    "react-day-picker": "^10.0.1",
    "react-dom": "^18",
    "resend": "^6.14.0"
  },
  "devDependencies": {
    ...
    "eslint": "^8",
    "eslint-config-next": "14.2.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5",
    ...
  }
  ```
- `eslint-config-next` is pinned to the exact Next.js version (`14.2.35`) — it must be bumped in lockstep with `next` itself, not independently.
- `tailwind.config.ts` exists (975 bytes) — Tailwind 4 removes the config file in favor of CSS-based `@theme` configuration in many setups; this is a structural change, not just a version bump. Read this file during the spike to gauge complexity.
- No `.github/workflows/ci.yml` exists yet at plan time — plan 004 adds one. This upgrade absolutely should not be attempted without that safety net in place first, given the app's money-handling and timezone-sensitive surface area.
- This repo is on `pnpm` — Next.js major-version upgrade guides typically provide a codemod (`npx @next/codemod@canary upgrade latest` or similar, exact command varies by target version) — verify the current recommended command for the specific target version during the spike, don't assume a syntax from general knowledge that may be stale.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Check outdated | `pnpm outdated`      | lists current vs. latest — re-run fresh, don't trust the numbers above as still accurate |
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Build     | `pnpm build`               | exit 0              |
| Tests     | `pnpm test:run` / `pnpm test:integration` | all pass |

## Scope

**In scope for this spike**:
- Research: read the Next.js 15 and 16 migration guides (official docs), the React 19 upgrade guide, and the Tailwind CSS v3→v4 upgrade guide.
- Produce a NEW plan file, `plans/010a-next-15-upgrade.md` (or similar, following this directory's template), scoping ONLY the first hop (Next 14→15, staying on React 18) as a self-contained, executable plan with its own steps/verification/STOP conditions — do not scope the full 14→16 + React 19 + Tailwind 4 jump in one plan.
- A short written recommendation on sequencing: which hop should happen first, and why (this plan's author's default assumption is Next 14→15 first while staying on React 18, since Next 15 supports both React 18 and 19, letting the Next and React upgrades be decoupled — verify this is still accurate for the versions found during the spike before committing to it).

**Out of scope**:
- Actually performing any upgrade — this plan produces a follow-up plan, it does not execute one.
- Tailwind 4 and ESLint 9+ migrations — note them as later hops in the sequencing recommendation, don't scope them in detail yet.

## Git workflow

- No code changes in this plan — its only deliverable is a new markdown file under `plans/`. If any exploratory `pnpm add`/version-check commands are run to test compatibility, do NOT commit any resulting `package.json`/lockfile changes — revert them (`git checkout -- package.json pnpm-lock.yaml`) before finishing, since this plan produces a plan, not a merged upgrade.

## Steps

### Step 1: Re-check current vs. latest versions

Run `pnpm outdated` fresh — versions may have moved since this plan was written (2026-07-13). Note the actual current gap.

**Verify**: command runs, output captured.

### Step 2: Research the Next.js upgrade path

Read the official Next.js upgrade guide for going from 14.2.x to the next major (15.x), and separately note what 15→16 additionally requires. Identify: required Node.js version, codemods available, known breaking changes most likely to affect THIS app specifically (App Router usage, middleware — note this app has a `middleware.ts` per plan 006, Server Actions, `fetch` caching defaults changes are a common Next 15 gotcha, dynamic API route changes).

**Verify**: no command — research step. Note findings for use in Step 4.

### Step 3: Research the Tailwind v4 and ESLint 9 migration scope

Read the Tailwind v3→v4 upgrade guide (structural: config file format, PostCSS setup changes) and note whether `tailwind.config.ts` in this repo uses any v3-only features that would need translating. Read what ESLint 9's flat-config migration requires relative to this repo's current `.eslintrc.json` (`{"extends": ["next/core-web-vitals", "next/typescript", "prettier"]}` — a fairly minimal config, likely a low-complexity migration, but confirm `eslint-config-next`'s ESLint-9-compatible version supports flat config the same way).

**Verify**: no command — research step.

### Step 4: Write `plans/010a-next-15-upgrade.md`

Using the plan template (`C:\Users\gadia\.claude\skills\improve\references\plan-template.md`), write a fully self-contained, executable plan for JUST the Next 14→15 hop (React stays on 18, Tailwind stays on 3, ESLint stays on 8 — isolate this one variable). Include: the exact codemod command to run, the specific breaking changes from Step 2 most likely to bite this app (name the exact files at risk — e.g. anything using `fetch` with implicit caching assumptions, any dynamic route handlers), a full regression test plan (manual booking-flow walkthrough per `HANDOFF.md`'s "Verification approach" section, plus `pnpm test:run`/`test:integration`), and STOP conditions specific to a framework upgrade (e.g. "if `next build` succeeds but any booking-flow page renders visibly differently, STOP").

**Verify**: `plans/010a-next-15-upgrade.md` exists and passes the plan-template's own "Quality bar" checklist (re-read that checklist from the template file and self-verify against it before finishing).

### Step 5: Update this plan's status and the index

Mark this plan (010) as DONE once 010a is written — this plan's job (producing a scoped, staged upgrade plan) is complete even though the upgrade itself hasn't happened. Add 010a to `plans/README.md`'s execution order, noting it depends on plan 004 (CI) landing first.

**Verify**: `plans/README.md` lists both 010 and 010a with correct statuses and the dependency note.

## Test plan

Not applicable — this plan produces research and a new plan document, not code. The plan IT PRODUCES (010a) must include its own full test plan per the template's requirements.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `plans/010a-next-15-upgrade.md` exists
- [ ] `git status` shows no changes to `package.json` or `pnpm-lock.yaml` (any exploratory version checks were reverted)
- [ ] `plans/README.md` updated with both 010 (DONE) and 010a (TODO, depends on 004)
- [ ] No files outside `plans/` are modified

## STOP conditions

Stop and report back (do not improvise) if:

- You find yourself starting to actually run the Next.js codemod or bump `package.json` versions "to see what breaks" — that's the next plan's job (010a), executed separately with its own review gate. This spike stays read-only on the actual dependency versions.
- Research reveals the Next 14→15 hop alone is actually low-risk enough that it could reasonably be merged with the React 19 bump (contradicting this plan's default assumption of decoupling them) — note this finding in 010a's "Why this matters" section rather than silently changing this plan's scope recommendation without flagging the reasoning.

## Maintenance notes

- This plan intentionally produces MORE plans rather than doing the upgrade itself — the upgrade is genuinely large enough (three coupled major-version bumps across the rendering framework, UI library, and CSS engine) that a single "just do it" plan would violate the plan-template's own guidance to keep each plan's steps independently verifiable.
- After 010a (Next 15) lands and is stable in production for a reasonable period, a follow-up 010b (Next 16 + React 19) and 010c (Tailwind 4) should be written using the same spike-then-scope approach — don't skip straight to writing them now, since the exact breaking changes to plan around may shift as this app's own code changes in the interim.
