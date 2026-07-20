# 026 — Clean up stray .claude/worktrees clutter

Planned at commit: `02be9c6`.

## Priority / Effort

P3 (DX hygiene) / S

## Problem

`.claude/worktrees/agent-*` — 10+ directories, each a full git worktree
checkout — sit inside the repo's working tree at `.claude/worktrees/`.
Before touching anything, confirm whether these are tracked by git or
already gitignored: run `git status` and `git check-ignore -v
.claude/worktrees` (or equivalent) to see. This plan's fix differs depending
on the answer — do not assume, verify first.

**Impact**: if untracked/gitignored, this is pure local-machine clutter (not
a repo-wide issue, don't overstate it) — but still worth cleaning up and
gitignoring properly so it doesn't accidentally get swept into a future
`git add -A`. If any of these are actually tracked in git, that's a more
real problem (bloats clone size, confuses onboarding) and should be
resolved with higher urgency than this plan's P3 assumes — if you find
that's the case, STOP and re-flag as higher priority rather than proceeding
under this plan's effort budget.

## Fix

1. Run `git status` and `git check-ignore -v .claude/worktrees/*` (adjust
   for this shell — PowerShell equivalent if needed) to determine current
   tracked/ignored state.
2. If untracked and not yet gitignored: add `.claude/worktrees/` to
   `.gitignore`.
3. If untracked and stale (no longer in active use): use `git worktree
   remove <path>` for each, not raw `rm -rf` — `git worktree remove` cleans
   up the internal worktree registration correctly; a raw delete leaves
   dangling references. Confirm with `git worktree list` before and after.
4. If any are tracked in git: STOP, do not delete anything under this plan.
   Re-report as a separate, higher-priority finding instead — tracked
   worktree checkouts in git history need a deliberate decision (e.g. `git
   filter-repo` or accepting the bloat), not an improvise-and-delete
   response.

## Files in scope

- `.gitignore`
- Local worktree directories under `.claude/worktrees/` (filesystem
  cleanup only, via `git worktree remove`, not tracked source files).

## Files explicitly out of scope

- Anything else under `.claude/` — don't sweep unrelated config while doing
  this cleanup.

## Verification

1. `git status` shows no untracked worktree clutter after the fix.
2. `git worktree list` shows only genuinely active worktrees remaining.
3. `.gitignore` includes the pattern going forward.

## Done criteria

- Stale worktrees removed via `git worktree remove` (not raw deletion).
- `.claude/worktrees/` gitignored so this doesn't recur.
- No tracked files were deleted (confirmed via step 4's STOP condition, if
  it applied).

## Maintenance note

If this repo's agent tooling (the `improve`/`execute` workflow itself)
routinely creates worktrees under `.claude/worktrees/` and doesn't clean up
after itself on completion, that's a tooling-level gap worth mentioning to
whoever maintains that tooling — not something to fix inside this repo.
