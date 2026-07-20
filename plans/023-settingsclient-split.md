# 023 — Split SettingsClient.tsx into focused components

Planned at commit: `02be9c6`.

## Priority / Effort

P3 (tech debt, mechanical refactor) / M

## Problem

`src/app/admin/settings/SettingsClient.tsx` is a 642-line client component
owning three unrelated concerns:

1. Studio settings form (rates, hours, deposit %, hold window).
2. QR/payment upload + Google Calendar connect/sync/disconnect.
3. Full equipment CRUD (add/toggle/quantity/delete).

Each concern maintains its own loading/error state pair independently — 7
separate `useState` error/loading pairs total. Any unrelated change (e.g. an
equipment quantity tweak) risks touching this entire file, and none of the
three concerns can be tested or reasoned about in isolation.

## Fix

Extract three child client components, keeping `SettingsClient` as a thin
composer that receives initial server data as props and renders the three
children:

- `StudioSettingsForm` — rates/hours/deposit%/hold-window form + its
  loading/error state.
- `GoogleCalendarPanel` — connect/sync/disconnect + its loading/error state.
- `EquipmentPanel` — add/toggle/quantity/delete CRUD + its loading/error
  state. While in this file, also apply the finding-013-adjacent cleanup:
  the equipment reload pattern (`reloadEquipment` called after every
  mutation, each wrapped in a near-identical
  `setEquipLoading(true) → action → reload-or-error → setEquipLoading(false)`
  block) is duplicated 4x (add/toggle/quantity/delete) — extract a single
  `runEquipmentAction(fn: () => Promise<Result>)` helper used by all four
  call sites while you're restructuring this code anyway. Do this only
  inside the new `EquipmentPanel` component, don't generalize it to the
  other two panels unless they have the exact same duplication pattern
  (verify first, don't assume).

This must be a **mechanical extraction with no behavior change** — same
props in, same DOM/behavior out. Do not "improve" validation logic, error
messages, or add new features while doing this split; that's explicitly out
of scope and would make the diff much harder to review safely.

## Files in scope

- `src/app/admin/settings/SettingsClient.tsx` (becomes the thin composer)
- New files: `src/app/admin/settings/StudioSettingsForm.tsx`,
  `src/app/admin/settings/GoogleCalendarPanel.tsx`,
  `src/app/admin/settings/EquipmentPanel.tsx` (or wherever this repo's
  convention puts co-located admin settings components — check if there's
  already a subdirectory pattern for admin components, e.g.
  `src/components/admin/`, and match it rather than inventing a new
  location).

## Files explicitly out of scope

- `src/app/admin/settings/page.tsx` (the server component that fetches
  initial data) — only touch if the prop shape passed to `SettingsClient`
  needs to change to fan out to the three new children, and even then keep
  that diff minimal.
- Any server action files (`src/lib/actions/admin/*`) — this is a pure
  client-component structural refactor, not a logic change.

## Verification

1. `npm run typecheck` passes.
2. `npm run lint` passes.
3. Manual test: exercise all three panels in the browser — update studio
   settings, connect/sync/disconnect Google Calendar (if testable in dev
   without real OAuth — otherwise verify the UI renders and click handlers
   fire), add/toggle/adjust-quantity/delete an equipment item. Confirm
   identical behavior to before the split (same success/error messages,
   same loading-state UI).
4. If any tests currently import from `SettingsClient.tsx` directly, update
   their imports to match the new structure — search for
   `from '.../SettingsClient'` across the repo first.

## Done criteria

- `SettingsClient.tsx` reduced to a thin composer (~50-100 lines).
- Three new focused components, each owning only its own concern's
  state/logic.
- No behavior change — verified by manual walkthrough of all three panels.
- `npm run typecheck && npm run lint` green.

## Maintenance note

Future settings-page additions (a new panel/concern) should follow this
same pattern — a new focused component, not more inline state in
`SettingsClient.tsx`.
