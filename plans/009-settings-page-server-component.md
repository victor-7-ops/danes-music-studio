# Plan 009: Convert admin settings page to a Server Component shell with client islands

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7879781..HEAD -- src/app/admin/settings/page.tsx`
> If the file changed since this plan was written, compare against the
> excerpt below before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED — settings page has several interactive sections (Google Calendar connect/disconnect, hours form, equipment CRUD); splitting needs care to keep server actions wired correctly
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `7879781`, 2026-07-13

## Why this matters

Every other admin page in this repo (`bookings`, `calendar`, `dashboard`) is an async Server Component that fetches its data server-side, before first paint. `src/app/admin/settings/page.tsx` alone is a `'use client'` component (530 lines) that fetches its initial data in a `useEffect` after mount, adding a loading-spinner round trip that the other admin pages avoid, and shipping more logic into the client bundle than necessary. This plan converts the data-fetching shell to a Server Component while keeping the genuinely interactive pieces (forms, buttons, equipment CRUD) as client islands — matching the pattern already established by `src/app/admin/dashboard/page.tsx`.

## Current state

- `src/app/admin/settings/page.tsx` — 530 lines total, `'use client'` at line 1. Read the FULL file before starting (only the first 100 lines were excerpted during the audit — the file is much longer and includes the Google Calendar connect/disconnect UI, the equipment CRUD form, and the settings form itself; all of this needs to be read to plan the split correctly).
- Initial data fetch happens in a `useEffect` (around line 72-100 in the excerpt seen so far):
  ```tsx
  useEffect(() => {
    async function loadSettings() {
      const supabase = createClient()
      const [settingsRes, serviceTypeRes] = await Promise.all([
        supabase.from('settings').select('*').single(),
        supabase.from('service_types').select('rate_per_hour').eq('name', 'Rehearsal').single(),
      ])
      ...
  ```
  Also fetches `equipment` via `reloadEquipment()` (lines 62-70), and separately tracks Google Calendar connection state (`gcalEmail`, `gcalConnected` — read further into the file to see how/where that's fetched, it wasn't in the first 100 lines read).
- Server actions already used by this page (imported at lines 6-10): `updateSettings`, `connectGoogleCalendar`, `disconnectGoogleCalendar`, `syncGoogleCalendar`, `createEquipment`, `updateEquipment`, `deleteEquipment` — all already exist as `'use server'` actions in `src/lib/actions/admin/`. This plan doesn't change any of them, only how the page's initial render is composed.
- Reference pattern: `src/app/admin/dashboard/page.tsx` — async Server Component, fetches with `await supabase.from(...)`, no `useEffect`, no loading state needed for initial render. Read this file's full structure (already read during audit) as the target shape for the new settings page shell.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Build     | `pnpm build`               | exit 0              |
| Lint      | `pnpm lint`               | exit 0              |

## Scope

**In scope**:
- `src/app/admin/settings/page.tsx` — split into a Server Component shell (`page.tsx`) that does the initial fetch, and one or more client components (e.g. `src/app/admin/settings/SettingsForm.tsx`, or split further per section — decide based on what Step 1's full read reveals about natural boundaries) that receive the initial data as props and own the interactive state.

**Out of scope**:
- Any server action in `src/lib/actions/admin/` — unchanged, called the same way from the client islands.
- The equipment CRUD logic itself — only where its initial `equipment` list is fetched (client `useEffect` → server-component prop), not how create/update/delete work.
- Any styling/visual changes beyond what's mechanically required by the component split.

## Git workflow

- Branch: `advisor/009-settings-server-component`
- Commit per step; message style matches `git log` (e.g. `perf: convert admin settings page to server component shell`)
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Read the full file and map its sections

Read all 530 lines of `src/app/admin/settings/page.tsx`. Identify the distinct sections (settings form, Google Calendar connect/disconnect, equipment CRUD, any others) and exactly which state/effects belong to each. Note every `useState`/`useEffect` and which section it serves. This determines whether one client component or several makes sense — prefer fewer, coarser splits over many tiny ones unless a section is clearly independent (e.g. equipment CRUD might reasonably be its own client component if it has no state dependency on the rest of the form).

**Verify**: no command — research step. Produce a short internal map (which lines belong to which section) before writing code.

### Step 2: Create the Server Component shell

Rewrite `src/app/admin/settings/page.tsx` as an `async function` Server Component (following `admin/dashboard/page.tsx`'s pattern) that:
- Fetches `settings`, `service_types` rate, and `equipment` server-side via `await supabase.from(...)`.
- Fetches Google Calendar connection state server-side too (find how `gcalEmail`/`gcalConnected` are currently derived — likely from the `google_tokens` table; move that read server-side as well).
- Passes all fetched data as props into a client component (created in Step 3).

**Verify**: `npx tsc --noEmit` → will fail until Step 3 exists — expected, continue.

### Step 3: Create the client component(s) for interactive sections

Based on Step 1's map, create one or more `'use client'` components (e.g. `src/app/admin/settings/SettingsClient.tsx`) that receive the server-fetched data as props, own the form state (`useState` for form fields, submit handlers calling the existing server actions), and render the interactive UI. Move the `searchParams`-driven feedback logic (`gcalFeedback`, `syncResult` — read how `useSearchParams` is used in the original file) into this client component since it needs client-side hooks.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 4: Wire the shell to the client component

In the Server Component shell from Step 2, import and render the client component(s) from Step 3, passing the fetched data as props.

**Verify**: `npx tsc --noEmit` → exit 0. `pnpm build` → exit 0, and check the build output doesn't show `/admin/settings` as an error or unexpectedly large client bundle chunk compared to before (informal check, not a hard gate).

## Test plan

No existing test covers this page (confirmed: no test file for `admin/settings`). This plan is a structural refactor with no new business logic — verification is manual:

1. `pnpm dev`, log in, visit `/admin/settings`.
2. Confirm the page loads with settings pre-populated immediately (no visible loading spinner/flash for the initial data — this is the actual improvement being verified).
3. Test the settings form: change operating hours, submit, confirm it saves (reload the page, confirm the change persisted).
4. Test Google Calendar connect/disconnect buttons still work (if a test Google account is available; otherwise confirm the buttons render correctly and the connect flow at least redirects to Google without erroring).
5. Test equipment CRUD: add a new equipment item, confirm it appears in the list without a full page reload; delete it, confirm it disappears.
6. Test the `?gcal=connected` / `?gcal=error` query-param feedback messages still render correctly (visit `/admin/settings?gcal=connected` directly and confirm the success message shows).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm build` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `head -1 src/app/admin/settings/page.tsx` does NOT show `'use client'` (confirms the shell is now a Server Component)
- [ ] `grep -rn "'use client'" src/app/admin/settings/` shows exactly the new client component file(s) created in Step 3, not `page.tsx`
- [ ] No files outside the in-scope list are modified (`git status`) — note new files created in `src/app/admin/settings/` are expected and in-scope per this plan
- [ ] `plans/README.md` status row updated
- [ ] Manual verification steps 1-6 above completed and confirmed working

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the location in "Current state" doesn't match the excerpt (drift since this plan was written) — re-read the full file fresh before starting Step 1 regardless, since only the first 100 lines were seen during planning.
- Step 1's full read reveals interdependencies between sections that make a clean split impractical (e.g. shared state that doesn't cleanly decompose) — report the specific coupling found and propose an alternative split rather than forcing an awkward one.
- Any server action call signature needs to change to fit the new component structure — server actions should be called identically to how they are today, just from a different component; if a signature change seems necessary, STOP and report why rather than modifying `src/lib/actions/admin/*` files (out of scope).

## Maintenance notes

- If a future settings section needs to be added, follow the same shell + client-island pattern established here rather than reverting to a single monolithic client component.
- A reviewer should pay particular attention to the Google Calendar connection state now being read server-side — confirm it still reflects real-time connection status correctly (there's no client-side polling in the original, so this shouldn't introduce staleness, but verify the exact read timing matches).
- Bundle size improvement from this change wasn't precisely measured in this plan — if bundle size is a concern later, compare `pnpm build`'s output before/after this change as a follow-up data point.
