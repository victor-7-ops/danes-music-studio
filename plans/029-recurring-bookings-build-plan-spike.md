# 029 — Recurring bookings: scope the build plan (follow-up to design spike 013)

Planned at commit: `02be9c6`.

## Priority / Effort

P2 (direction — largest scoped opportunity, but sequence after quick-rebook
per the tradeoff noted below) / S (this plan is itself a scoping spike, not
full implementation — expect it to produce a real 030-style build plan as
its output, similar to how 013 produced 013a)

## Problem

`plans/013-recurring-bookings-spike.md` and
`plans/013a-recurring-bookings-design.md` were merged (commit `a1f7b62`
region — confirm via `git log --oneline -- plans/013*`), establishing that
recurring bookings (same band, same slot, weekly) is a validated, wanted
feature for this rehearsal-studio product. No implementation build plan
exists yet — the gap between "design spike done" and "actual plan to build
it" is unaddressed.

This is exactly the kind of feature that compounds complexity with the
already-tightened `bookings_no_overlap` DB constraint and the equipment
double-booking race being fixed in plan 016 — recurring series touch
booking creation, the overlap constraint (does each occurrence get its own
row? one row with a recurrence rule?), and cancellation semantics (cancel
one occurrence vs. the whole series). Read `plans/013a-recurring-bookings-design.md`
in full before doing anything else — it likely already answers some of
these questions; don't re-derive from scratch what the spike already
decided.

## Fix (spike deliverable)

1. Read `013` and `013a` fully. Identify what's already decided vs. what was
   left open (the plans/README.md dependency notes mention a possible
   blocked follow-up "013b" pending the studio owner's answer on
   deposit-per-occurrence-vs-per-series — check if that question has since
   been answered anywhere, e.g. in HANDOFF.md or a later commit message; if
   still open, this plan cannot produce a full build plan and should instead
   produce a short "here's what's still blocked and why" note plus
   AskUserQuestion-style flagged decision for whoever executes this).
2. If the deposit question (and any other open question from 013a) has an
   answer available, write the actual build plan (as a new
   `plans/030-recurring-bookings-implementation.md` or next available
   number) following this same template — covering: schema changes (new
   `recurrence_rule`/series-linking columns or a separate table?),
   interaction with `bookings_no_overlap`, interaction with the equipment
   conflict-check from plan 016 (recurring + equipment is a compounding
   risk surface — flag explicitly), cancellation UX (single occurrence vs.
   series), and deposit handling.
3. If the deposit question is still unanswered, STOP short of writing a
   full build plan — instead produce a short decision-request document
   (or update `013a`'s status) clearly stating what's blocking, and leave
   this plan's own status as BLOCKED with that one-line reason, per the
   skill's status conventions.

## Files in scope

- Read-only research into `plans/013*.md`, `HANDOFF.md`, relevant schema
  (`supabase/migrations/**` for bookings-related tables), and
  `src/lib/actions/createBooking.ts`.
- Output: either a new numbered build plan, or a BLOCKED status update with
  a clear one-line reason — this spike plan does not itself touch
  `src/` or `supabase/migrations/**`.

## Files explicitly out of scope

- Do not implement recurring bookings in this plan — scoping/spike only.

## Verification

N/A — this plan's deliverable is a document (new build plan or a
BLOCKED note), not code. "Verification" is: does the resulting build plan
(if produced) meet the same self-containment and evidence bar as every
other plan in this directory (per the `improve` skill's plan-template
standards)?

## Done criteria

- Either: a new, fully self-contained build plan exists at the next
  available plan number, ready for an executor with no other context; OR
- This plan's own status is updated to BLOCKED with the specific open
  question (e.g. "deposit-per-occurrence-vs-per-series still needs studio
  owner's answer") as the one-line reason.

## Maintenance note

Sequence this after plan 012/012b (quick-rebook) per the direction
tradeoff already noted in the prior audit — recurring bookings is larger
and riskier; land the smaller, already-designed win first.
