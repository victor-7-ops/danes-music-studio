# Plan 004: Add a GitHub Actions CI workflow gating typecheck, lint, and tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7879781..HEAD -- package.json`
> If `package.json` scripts changed since this plan was written, compare
> against the excerpt below before proceeding; on a mismatch, treat it as a
> STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `7879781`, 2026-07-13

## Why this matters

No `.github` directory exists in this repo — nothing automated gates a PR or push on `tsc --noEmit`, `eslint`, or `vitest`. Vercel's own build step only catches errors that break `next build`; it doesn't run the lint or test suites, and some type errors in files outside the Next.js build graph could slip through entirely. For a booking app where money is stored in integer centavos and timezone math (Asia/Manila) is a documented recurring bug source, an automated pre-merge gate is the cheapest possible insurance against a logic regression shipping straight to production. This plan adds a minimal workflow; it doesn't add new test coverage (see plan 005 for that).

## Current state

- `package.json` — full `scripts` block today:
  ```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest",
    "test:run": "vitest run",
    "test:integration": "vitest run --config vitest.integration.config.mts",
    "seed": "tsx --env-file=.env.local scripts/seed.ts"
  }
  ```
  There is no `typecheck` script despite `typescript` being a devDependency — add one.
- Package manager: `pnpm` (confirmed via `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and `.npmrc` present at repo root). Node version: `package.json` doesn't pin an engines field — check `.nvmrc`/`.tool-versions` (none found); use Node 20 LTS in the workflow (matches `@types/node: ^20` devDependency).
- `vitest.integration.config.mts` requires `SUPABASE_SERVICE_ROLE_KEY` and other env vars loaded from `.env.local` (see its `config({ path: '.env.local' })` call) — this test suite talks to a real Supabase instance and CANNOT run in a generic CI job without secrets provisioned. Keep `test:integration` OUT of the default CI job; only `test:run` (unit tests) belongs in the required gate.
- No `.github` directory exists at all — this is a from-scratch addition.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck (new) | `pnpm typecheck`   | exit 0, no errors   |
| Lint      | `pnpm lint`               | exit 0, "No issues found" |
| Tests     | `pnpm test:run`           | all pass (currently 4-5 test files, confirmed passing at plan time) |
| Build     | `pnpm build`               | exit 0 (sanity check only — Vercel already gates this separately, but useful locally) |

## Scope

**In scope**:
- `package.json` — add a `typecheck` script.
- New file: `.github/workflows/ci.yml`.

**Out of scope**:
- `vitest.integration.config.mts` / `test:integration` — do NOT add this to the required CI job; it needs live Supabase credentials this plan doesn't provision. If you want to note it for a future follow-up, mention it in Maintenance notes below, don't build it now.
- Husky / pre-commit hooks — that's plan 004's sibling DX finding but out of scope for THIS plan (kept separate deliberately; a repo-level CI gate covers the same risk more reliably and doesn't depend on every contributor's local setup).
- Any Vercel configuration changes.
- Any existing test file content — this plan doesn't fix or add tests, only wires up running the ones that exist.

## Git workflow

- Branch: `advisor/004-ci-pipeline`
- Commit per step; message style matches `git log` (e.g. `chore: add CI workflow for typecheck, lint, and tests`)
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Add the `typecheck` script

In `package.json`, add to the `scripts` block (alphabetical-ish placement next to `test`, or wherever fits the existing order — the existing order isn't strictly alphabetical, so just add it after `"lint"`):

```json
"typecheck": "tsc --noEmit",
```

**Verify**: `pnpm typecheck` → exit 0, no output (or "No errors found" depending on TS version's verbosity).

### Step 2: Create the CI workflow file

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Unit tests
        run: pnpm test:run
```

Check the installed `pnpm` version locally (`pnpm --version`) and set the `pnpm/action-setup` version field to match the major version in use, so CI resolves the lockfile the same way local dev does.

**Verify**: no command to run locally for this step (GitHub Actions only executes on GitHub) — instead validate the YAML is syntactically correct: `npx js-yaml .github/workflows/ci.yml` (if `js-yaml` isn't available, any YAML linter/parser works, or a careful manual read is acceptable) → no parse errors.

### Step 3: Confirm the full pipeline passes locally before relying on CI

Run the exact three commands the workflow runs, in order, from a clean state:

```
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test:run
```

**Verify**: all four commands exit 0 in sequence. If `pnpm install --frozen-lockfile` fails, the lockfile is out of sync with `package.json` (likely because Step 1 added a script, which doesn't touch dependencies — if it still fails, STOP and report, don't regenerate the lockfile blindly).

## Test plan

This plan adds infrastructure, not test code — no new test files. The "test" for this plan is: push a branch with an intentional break (e.g. a stray type error) to confirm the workflow actually fails as expected, then revert it. If pushing to GitHub isn't available in this environment, skip that live-fire check and rely on Step 3's local dry run as sufficient verification — note in your completion report which verification path was used.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:run` exits 0
- [ ] `.github/workflows/ci.yml` exists and is valid YAML
- [ ] `grep -n "typecheck" package.json` shows the new script
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `pnpm typecheck` (the new script) surfaces pre-existing type errors that `npx tsc --noEmit` didn't show at plan-writing time — this would mean the codebase drifted; report the errors found rather than trying to fix unrelated code to make CI pass.
- `pnpm lint` or `pnpm test:run` fail for reasons unrelated to this plan's changes — same as above, report and stop rather than fixing unrelated failures.
- The repo's actual `pnpm` version (check `pnpm --version` and `packageManager` field in `package.json` if present) differs meaningfully from what's assumed in Step 2 — adjust the workflow's `pnpm/action-setup` version to match, don't guess.

## Maintenance notes

- `test:integration` was deliberately excluded from this CI job because it requires `SUPABASE_SERVICE_ROLE_KEY` and hits a real Supabase instance. A future follow-up could add it as a separate, optional workflow job using GitHub Actions secrets for a dedicated test Supabase project — flag this to the maintainer as a deliberate scope cut, not an oversight.
- Once this workflow is live and green for a few PRs, consider marking it as a required status check in the repo's branch protection settings (GitHub UI, not something this plan can configure) so it actually blocks merges rather than just reporting.
- If `pnpm build` (the Next.js production build) is ever added to this job, note it will need all the same env vars Vercel provides in production — likely to fail in CI without secrets provisioned. Left out of this plan's job for that reason.
