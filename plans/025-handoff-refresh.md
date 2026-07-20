# 025 — Refresh HANDOFF.md to current state

Planned at commit: `02be9c6`.

## Priority / Effort

P3 (docs accuracy — misleads "where do I pick up" reading) / S

## Problem

`HANDOFF.md:32-36` lists a "not yet done" list (run tsc, run vitest, apply a
specific migration, manual browser walkthrough) referencing an uncommitted
diff and a specific migration (`20260015000000`) that predates most of the
current `main` branch. Since that snapshot was written, `main` has merged
roughly 20 plans (001-015 in `plans/`, plus the equipment feature commits,
CI pipeline, dashboard comparison, settings redesign). A reader who opens
HANDOFF.md expecting "the current pickup point" gets a state that's now far
behind reality.

## Fix

Rewrite the "current status" / "not yet done" sections of HANDOFF.md to
reflect actual current state:

1. Read `plans/README.md`'s status table (now current as of this session —
   9 of the original 14 plans are DONE, only 005/010/012 remain TODO, plus
   the new 015-030 range from this audit) and summarize it in HANDOFF.md
   rather than duplicating a stale hand-written list.
2. Either: (a) replace the stale "not yet done" list entirely with a
   pointer — "see `plans/README.md` for current status, this file is a
   product/architecture overview, not a live task tracker" — or (b) if
   HANDOFF.md is meant to stay a snapshot-style status doc, update its
   timestamp/commit reference and regenerate the list from current `git
   log` + `plans/README.md`, whichever this repo's convention prefers
   (check if HANDOFF.md has been updated incrementally before, via `git log
   --follow HANDOFF.md`, to infer the intended convention before choosing).
3. Keep the parts of HANDOFF.md that are still accurate (product context,
   architecture invariants, the PayMongo-is-off note that plan 024 in
   README should now match) — this is a targeted refresh of the stale
   status section, not a full rewrite.

## Files in scope

- `HANDOFF.md` only.

## Files explicitly out of scope

- `README.md` — plan 024 handles that separately.
- `plans/README.md` — already current as of this session, don't duplicate
  effort re-verifying it here, just read and summarize it.

## Verification

1. Read the updated HANDOFF.md and confirm every "status" claim in it
   matches either `plans/README.md`'s status table or `git log` — no
   hand-guessed status.
2. Confirm the stale migration reference (`20260015000000`) and stale
   uncommitted-diff description are removed or clearly re-dated.

## Done criteria

- HANDOFF.md's status section reflects the current state (9+ plans DONE,
  current open plan list) rather than a snapshot from before most of
  `main`'s recent history.
- No dangling references to specific stale migrations/diffs that no longer
  describe the repo's actual state.

## Maintenance note

Recommend establishing a convention going forward: HANDOFF.md links to
`plans/README.md` for live status rather than embedding a duplicate,
independently-maintained list — two sources of truth for the same
information is exactly how it went stale this time.
