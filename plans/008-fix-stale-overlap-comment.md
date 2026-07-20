# Plan 008: Fix stale/misleading overlap-check comment in `createWalkIn`

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7879781..HEAD -- src/lib/actions/admin/createWalkIn.ts supabase/migrations/20260015000000_9_1_overlap_include_completed.sql`
> If either file changed since this plan was written, compare against the
> excerpts below before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: docs
- **Planned at**: commit `7879781`, 2026-07-13

## Why this matters

`createWalkIn.ts` has a comment claiming the app-level `SELECT`-then-check overlap query is "CRITICAL" because "walk_in completed rows bypass the EXCLUDE constraint." That was true before migration `20260015000000_9_1_overlap_include_completed.sql`, which widened the `bookings_no_overlap` EXCLUDE constraint to cover all non-cancelled statuses (including `completed`). The comment is now factually wrong and could mislead a future maintainer into either (a) thinking the app-level check is the only protection and skipping it "for performance" without realizing the DB constraint has them covered, or (b) not understanding that the app-level check is now a race-prone (TOCTOU) UX nicety, not the real safety mechanism. This is a pure documentation fix — no behavior changes.

## Current state

- `src/lib/actions/admin/createWalkIn.ts:42-53` — the comment and check in question:
  ```ts
  // CRITICAL: App-level overlap check — walk_in completed rows bypass the EXCLUDE constraint
  const { data: conflicts, error: overlapError } = await supabase
    .from('bookings')
    .select('id')
    .in('status', ['pending', 'confirmed'])
    .lt('start_at', end_at)
    .gt('end_at', start_at)

  if (overlapError) return { success: false, error: overlapError.message }
  if (conflicts && conflicts.length > 0) {
    return { success: false, error: 'Time slot overlaps an existing booking.' }
  }
  ```
  Note also: this check filters `.in('status', ['pending', 'confirmed'])` — it does NOT check against existing `completed` walk-ins, which is a separate, more subtle point worth noting in the corrected comment (the app-level check's coverage is actually narrower than the DB constraint's, by design — the DB constraint is the real backstop for `completed` overlaps).
- `supabase/migrations/20260015000000_9_1_overlap_include_completed.sql:30-33` — confirms the EXCLUDE constraint now covers `WHERE status <> 'cancelled'` (i.e., `pending`, `confirmed`, AND `completed`). Read this migration file in full to quote its exact current constraint definition accurately in the new comment.
- `createWalkIn.ts:89-97` — the existing error-handling branch that already correctly treats the DB constraint firing as the safety net:
  ```ts
  if (insertError) {
    if (
      insertError.message.includes('bookings_no_overlap') ||
      insertError.message.includes('exclusion constraint')
    ) {
      return { success: false, error: 'Time slot overlaps an existing booking.' }
    }
    return { success: false, error: insertError.message }
  }
  ```
  This confirms the DB constraint IS the real backstop today — the comment fix should say so explicitly.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0 (comment-only change, should be a no-op) |
| Lint      | `pnpm lint`               | exit 0              |

## Scope

**In scope**:
- `src/lib/actions/admin/createWalkIn.ts` — the comment at line 42 only.

**Out of scope**:
- Any logic change to the overlap check itself, the insert, or the error handling — this is a comment-only fix.
- The migration file — read-only reference, not modified.

## Git workflow

- Branch: `advisor/008-fix-overlap-comment`
- Commit; message style matches `git log` (e.g. `docs: correct stale overlap-check comment in createWalkIn`)
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Replace the stale comment

Read the exact current constraint definition from `supabase/migrations/20260015000000_9_1_overlap_include_completed.sql` first, then replace the comment at `createWalkIn.ts:42`:

```ts
// App-level overlap check: gives a friendly error message before hitting the
// DB constraint. It only checks pending/confirmed statuses, not completed
// walk-ins — that's intentional. The real race-safe backstop is the
// bookings_no_overlap EXCLUDE constraint (see
// supabase/migrations/20260015000000_9_1_overlap_include_completed.sql),
// which covers all non-cancelled statuses including completed and is
// enforced atomically by Postgres, closing the TOCTOU gap this SELECT-then-
// INSERT check can't close on its own. The catch block below (insertError
// handling) is what actually prevents a double-booking under concurrency.
```

Adjust wording only if Step 1's read of the migration file reveals different exact status coverage than described here — quote what the migration actually says, don't assume.

**Verify**: `npx tsc --noEmit` → exit 0 (comment change only, should never fail typecheck).

## Test plan

None needed — comment-only change with no behavioral surface to test. `pnpm test:run` should show zero change in pass/fail results before vs. after.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:run` exits 0, identical results to before this change
- [ ] `grep -n "CRITICAL: App-level" src/lib/actions/admin/createWalkIn.ts` returns no matches (old comment removed)
- [ ] `git diff src/lib/actions/admin/createWalkIn.ts` shows ONLY a comment change, zero lines of actual code (non-comment) touched
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts (drift since this plan was written) — in particular, if the migration file's constraint definition has changed further since this plan was written, re-verify what it actually covers before writing the corrected comment.
- Any attempt to write this comment requires changing actual logic (it shouldn't) — if you find yourself wanting to change the `.in('status', ...)` filter or the insert logic "while you're in there," don't — that's out of scope for this plan.

## Maintenance notes

- This is a pure documentation fix; no follow-up expected. If a future migration changes the EXCLUDE constraint's coverage again, this comment should be updated again at that time — treat it as living documentation tied to the migration, not a one-time fix.
