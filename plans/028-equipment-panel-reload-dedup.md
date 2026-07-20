# 028 — Deduplicate equipment mutation/reload pattern

Planned at commit: `02be9c6`. If plan 023 (SettingsClient split) lands
first, this plan's scope moves entirely into the new `EquipmentPanel.tsx`
component — check plan 023's status before starting and adjust the target
file path accordingly; don't duplicate the dedup work if 023 already did it
inline during the split (023 explicitly permits doing this dedup as part of
its extraction — check its plan text and `plans/README.md` status first).

## Priority / Effort

P3 (small, real duplication) / S

## Problem

In `src/app/admin/settings/SettingsClient.tsx:71-79`, `reloadEquipment` is
called identically after four separate mutations — add (line ~202), toggle
(~213), quantity update (~225), delete (~236) — each wrapped in a nearly
identical block:

```ts
setEquipLoading(true)
const result = await someEquipmentAction(...)
if (result.success) {
  await reloadEquipment()
} else {
  setEquipError(result.error)
}
setEquipLoading(false)
```

Four copies of the same ~8-line pattern. Any future change (optimistic UI
update, toast notification, retry logic) means editing all four call sites
identically and keeping them in sync by hand.

## Fix

Extract a single helper (name it `runEquipmentAction` or similar,
consistent with the file's existing naming conventions):

```ts
async function runEquipmentAction(fn: () => Promise<{ success: boolean; error?: string }>) {
  setEquipLoading(true)
  const result = await fn()
  if (result.success) {
    await reloadEquipment()
  } else {
    setEquipError(result.error ?? 'Something went wrong.')
  }
  setEquipLoading(false)
}
```

Replace all four call sites with `runEquipmentAction(() =>
someEquipmentAction(...))`. Read the current four blocks carefully first —
confirm they really are identical modulo the action call itself (the audit
found them "near-identical," verify there's no subtle per-call-site
difference, e.g. a different error message fallback, before collapsing them
— if one differs meaningfully, either preserve that difference via a
parameter or leave that one call site alone rather than losing behavior).

## Files in scope

- `src/app/admin/settings/SettingsClient.tsx`, or
  `src/app/admin/settings/EquipmentPanel.tsx` if plan 023 landed first
  (adjust target per that plan's outcome).

## Files explicitly out of scope

- The studio-settings-form and Google-Calendar sections of the same file —
  don't touch their state/logic even if you notice similar patterns there;
  scope this to equipment only, per the original finding.

## Verification

1. `npm run typecheck` passes.
2. Manual test: exercise all four equipment mutations (add, toggle
   active/inactive, change quantity, delete) in the browser, confirm
   identical success/error behavior and UI feedback to before the change.

## Done criteria

- Four duplicated blocks replaced by one shared helper, all four call sites
  using it.
- No behavior change, verified manually.
- `npm run typecheck` passes.

## Maintenance note

None beyond what's already noted in plan 023 if that plan subsumes this
file location.
