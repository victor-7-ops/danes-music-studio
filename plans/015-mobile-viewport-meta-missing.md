# 015 — Restore mobile viewport meta tag

Planned at commit: run `git rev-parse --short HEAD` before starting; if it
doesn't match `02be9c6`, re-verify the excerpt below still matches
`src/app/layout.tsx` before proceeding (drift check).

## Priority / Effort

P0 (live production bug, site-wide, trivial fix) / S

## Problem

`src/app/layout.tsx` exports:

```ts
export const viewport = {
  themeColor: '#0B0B0C',
}
```

Next.js (App Router) only auto-injects the default
`<meta name="viewport" content="width=device-width, initial-scale=1">` tag
when a route/layout does **not** export a custom `viewport` object. As soon
as any `viewport` export exists, Next.js renders exactly what you gave it —
here, only a `theme-color` meta tag, no `width`/`initial-scale`.

Effect: mobile browsers receive no viewport width directive, fall back to
the ~980px desktop-layout default, and zoom the whole page out to fit the
screen. Content is present in the DOM but visually tiny/off-screen — this is
what's being reported as "the dashboard on admin is not showing" on mobile.
It affects every page on the site (public booking pages included), not just
`/admin/dashboard` — the admin dashboard's dense stat-card grids just make
the effect most noticeable there.

Verify before starting: load any page (e.g. `/admin/dashboard`) in a mobile
viewport (Chrome DevTools device toolbar, 375×812) and confirm the page
renders zoomed out / requires pinch-zoom to read. Check page source /
rendered `<head>` for absence of a `width=device-width` viewport meta tag.

## Fix

In `src/app/layout.tsx`, change:

```ts
export const viewport = {
  themeColor: '#0B0B0C',
}
```

to:

```ts
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B0B0C',
}
```

Import the `Viewport` type from `next` if you want type safety:

```ts
import type { Metadata, Viewport } from 'next'
// ...
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B0B0C',
}
```

Do not touch `export const metadata` — unrelated, already correct.

## Files in scope

- `src/app/layout.tsx` — the only file that needs changing.

## Files explicitly out of scope

- Do not add `maximumScale` or `userScalable: false` — no accessibility
  justification was given for blocking pinch-zoom; only restore the missing
  default.
- Do not touch `AdminSidebar.tsx`, `AdminLayout`, or the dashboard page —
  their responsive classes (`md:hidden`, `md:ml-56`, `grid-cols-1
  md:grid-cols-3`, etc.) are already correct and were verified during
  investigation; they only misbehave because the viewport meta tag is
  missing upstream. Do not "fix" them.

## Verification

1. `npm run typecheck` — must pass (or `pnpm typecheck` — confirm this
   repo's package manager first; `package.json` scripts use plain names,
   check for a lockfile: `pnpm-lock.yaml` vs `package-lock.json`).
2. `npm run dev`, load `/admin/dashboard` (log in first) and the public `/`
   page in a mobile-width browser viewport (DevTools device toolbar, iPhone
   or 375×812 generic). Confirm:
   - Page renders at mobile width without being zoomed out.
   - No horizontal scroll on either page.
   - Admin sidebar hamburger, dashboard stat cards, and date-range form are
     all visible and usable without pinch-zoom.
3. View page source / inspect rendered `<head>` and confirm a
   `<meta name="viewport" content="width=device-width, initial-scale=1">`
   tag is present.

## Done criteria

- `viewport` export in `src/app/layout.tsx` includes `width: 'device-width'`
  and `initialScale: 1`.
- Typecheck passes.
- Manual mobile-viewport check (step 2 above) confirms normal rendering on
  at least `/admin/dashboard` and `/`.

## Maintenance note

If a future page/layout adds its own `viewport` export (Next.js allows
per-route overrides), it must also include `width`/`initialScale` unless
intentionally opting out — this is an easy regression to reintroduce.
