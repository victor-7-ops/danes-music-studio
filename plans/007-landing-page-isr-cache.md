# Plan 007: Cache the landing page's studio-photos storage listing with ISR

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7879781..HEAD -- src/app/page.tsx`
> If the file changed since this plan was written, compare against the
> excerpt below before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `7879781`, 2026-07-13

## Why this matters

The landing page (`src/app/page.tsx`) is the highest-traffic route — it was recently SEO-optimized specifically to drive organic search traffic (see recent commits: metadata, structured data, sitemap). On every single request, it does a live `supabase.storage.from('studio-photos').list()` call to fetch the gallery images, with no caching. Studio photos change rarely (uploaded manually via the Supabase dashboard per the README's deploy instructions). Adding ISR (Incremental Static Regeneration) via a `revalidate` export turns this into a cached, periodically-refreshed fetch instead of a live call on every visitor — free performance for a route that's about to get more organic traffic.

## Current state

- `src/app/page.tsx` — full file read (153 lines). The relevant part, lines 47-53:
  ```tsx
  export default async function Page() {
    const supabase = await createClient()
    const { data: files } = await supabase.storage.from('studio-photos').list()
    const imageExtensions = /\.(jpe?g|png|webp|avif)$/i
    const urls = (files ?? [])
      .filter(f => imageExtensions.test(f.name))
      .map(f => supabase.storage.from('studio-photos').getPublicUrl(f.name).data.publicUrl)
    ...
  ```
  No `export const revalidate` exists anywhere in this file. The rest of the page (hero section, JSON-LD structured data, `SiteFooter`) is entirely static content — no per-request personalization, no cookies/session reads anywhere in this file (confirmed by reading it in full — it calls `createClient()` only for the storage listing, not for any auth/session-dependent rendering).
- `createClient()` here is `@/lib/supabase/server` — the same server client used elsewhere; using it inside an ISR-cached page is fine since this page doesn't read per-user session state from it, only public storage listing.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Build     | `pnpm build`               | exit 0, confirms the route is marked ISR in build output |
| Lint      | `pnpm lint`               | exit 0              |

## Scope

**In scope**:
- `src/app/page.tsx` — add `export const revalidate = 3600`.

**Out of scope**:
- Any other page — this plan only touches the root landing page.
- `SiteFooter`, `DmsHero`, `InsideStudioStrip`, `GrainOverlay` components — unchanged.
- The Supabase storage bucket itself or its contents.

## Git workflow

- Branch: `advisor/007-landing-page-isr`
- Commit; message style matches `git log` (e.g. `perf: cache landing page studio-photos listing with ISR`)
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Add the `revalidate` export

In `src/app/page.tsx`, add near the top of the file (after imports, before the `JSON_LD` constant or the `Page` function — either position is fine, Next.js just needs it exported at module scope):

```tsx
export const revalidate = 3600 // 1 hour — studio photos change rarely
```

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Confirm the build marks the route as ISR

```
pnpm build
```

**Verify**: the build output's route summary (printed to stdout, look for the table listing routes with a `○`/`●`/`λ` symbol legend) shows `/` marked with the ISR/revalidate indicator (Next.js prints a legend like "● (SSG) ... revalidate" — check the specific symbol Next 14.2 uses in its output and confirm `/` matches the static-with-revalidate category, not fully dynamic).

## Test plan

No unit test applies (this is a caching-behavior change to a Server Component with no pure logic to test). Manual verification:

1. `pnpm build && pnpm start` (production mode, since `revalidate` behavior differs from `next dev`, which always renders fresh).
2. Visit `/` twice in a row — both should load with photos.
3. Upload a new test photo to the `studio-photos` bucket via Supabase dashboard.
4. Refresh `/` immediately — the new photo should NOT yet appear (still serving the cached version) unless more than 3600 seconds have passed since the last generation, or unless this is the very first request that triggers regeneration in the background (Next's stale-while-revalidate: the current request gets the old cached version, the NEXT request after that gets the regenerated one). Confirm this matches expected ISR behavior, not "instantly reflects every storage change."
5. Remove the test photo after verifying to avoid leaving test data in the production bucket.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm build` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `grep -n "export const revalidate" src/app/page.tsx` shows the new line
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated
- [ ] Manual verification steps 1-5 above completed (or steps 3-5 explicitly skipped if no non-production Supabase bucket is available to test against safely — report which path was taken)

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the location in "Current state" doesn't match the excerpt (drift since this plan was written) — in particular, if the page has gained any per-request personalization (cookies, session-dependent content) since this plan was written, ISR caching would be incorrect to add; re-read the full file and confirm it's still purely public/static content before proceeding.
- `pnpm build`'s route table doesn't show `/` as statically-generated-with-revalidate after adding the export — report the exact build output rather than assuming the change worked.

## Maintenance notes

- If the landing page ever gains per-visitor personalization (e.g. a "welcome back" banner using cookies), this `revalidate` export needs to be reconsidered — ISR caches the full rendered page, so personalized content would leak across visitors under this caching strategy.
- If the studio owner reports "I uploaded new photos and they're not showing up," the expected/correct behavior is: wait up to `revalidate` seconds (3600 = 1 hour), or trigger a manual revalidation via Next's on-demand revalidation API if that's ever added — this is expected ISR behavior, not a bug, and should be explained rather than "fixed" by removing the cache.
