# Plan 003: Convert booking cancel/reschedule links from state-changing GET to a confirm-then-POST flow

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 7879781..HEAD -- src/app/api/booking/cancel/route.ts src/app/api/booking/reschedule/route.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `7879781`, 2026-07-13

## Why this matters

`/api/booking/cancel` and `/api/booking/reschedule` mutate a booking's status (`cancelled`) on a plain `GET` request, gated only by an unguessable `cancel_token` in the URL — the token that's emailed to the customer in their confirmation email. Email link-scanners (Outlook Safe Links, corporate gateways, some chat-app unfurlers) routinely prefetch `GET` links found in email bodies as part of malware scanning. That prefetch alone would silently cancel a real customer's booking without them ever clicking, since the route requires no confirmation step beyond the token being present. Splitting into a `GET` (renders a confirmation page) + `POST` (performs the mutation) removes this risk while keeping the same token-based trust model — no new auth mechanism needed.

## Current state

- `src/app/api/booking/cancel/route.ts` — full file, 53 lines. `GET` handler does token lookup, validity checks (not already cancelled, not in the past), then directly runs `.update({ status: 'cancelled' })` at line 37, sends a cancel email, deletes the GCal event, and redirects.
- `src/app/api/booking/reschedule/route.ts` — full file, 54 lines. Same shape: `GET` handler validates the token then directly cancels the booking (line 42) and redirects to `/book?rescheduled_from=...`. Comment at lines 7-12 explains the design rationale (no PayMongo live path, token is the trust boundary) — that rationale still holds; this plan doesn't change the trust model, just moves the mutation off `GET`.
- `src/app/booking/[code]/page.tsx` — the page a customer lands on after booking; it's where the "Cancel booking" link currently points (likely `/api/booking/cancel?token=...` as an `<a href>` — read this file to confirm the exact link markup before editing).
- Confirmation emails: find where the cancel/reschedule links are generated for the email templates — check `src/lib/emails/templates/` and `src/lib/emails/` for the template that includes these URLs (likely a confirmation or reminder email template). These links must be updated to point at a new confirmation page route, not the API route directly.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `npx tsc --noEmit`       | exit 0              |
| Lint      | `pnpm lint`               | exit 0              |
| Tests     | `pnpm test:run`           | all pass            |

## Scope

**In scope**:
- `src/app/api/booking/cancel/route.ts` — split `GET` (validate token, render/redirect to confirm page) from a new `POST` handler (perform the mutation).
- `src/app/api/booking/reschedule/route.ts` — same split.
- New page: `src/app/booking/[code]/cancel-confirm/page.tsx` (or similar — a lightweight confirmation page that shows booking details and a "Confirm cancellation" button that `POST`s to the API route). Match the styling/structure of `src/app/booking/[code]/page.tsx`.
- Any file that generates the cancel/reschedule email links (found during Step 1) — update the URL to point at the new confirm page instead of directly at the API route.
- `src/components/booking/` — only if a shared button/form component pattern already exists that should be reused for the confirm button (check before writing a new one).

**Out of scope**:
- The token generation/validation logic itself (`cancel_token` column, how it's created) — unchanged.
- `src/lib/gcal/pushSync.ts` (`deleteGcalEvent`) — called the same way, just from the new `POST` handler instead of `GET`.
- `src/lib/emails/cancel.ts` (`sendCancelEmail`) — called the same way from the new `POST` handler.
- PayMongo-related code — not touched, this plan doesn't change payment flow.

## Git workflow

- Branch: `advisor/003-cancel-reschedule-post`
- Commit per step; message style matches `git log` (e.g. `fix: require POST confirmation for booking cancel/reschedule`)
- Do NOT push or open a PR unless explicitly instructed.

## Steps

### Step 1: Find every place that generates cancel/reschedule links

Search the codebase for where `/api/booking/cancel` and `/api/booking/reschedule` URLs are constructed (likely in email templates and possibly `src/app/booking/[code]/page.tsx`):

```
grep -rn "booking/cancel\|booking/reschedule" src/ --include="*.ts" --include="*.tsx"
```

List every match. These are the places that need updating in Step 4 to point at the new confirm page instead of the API route directly.

**Verify**: command runs, output captured for reference in later steps.

### Step 2: Build the cancel confirmation page

Create `src/app/booking/[code]/cancel-confirm/page.tsx`. It should:
- Accept `token` as a search param (matching the existing link shape: `?token=...`).
- Server-side, look up the booking by `cancel_token` (same query shape as the current `GET` handler in `cancel/route.ts` lines 15-19) to display booking details (date, time, band name) and validate the token is real and the booking isn't already cancelled/in the past — reuse the same validation logic, redirecting to the same error query params (`?error=invalid_link`, `?error=already_cancelled`, `?error=past_booking`) on failure, pointing back at `/booking/[code]` for consistency with current behavior.
- Render a form with a hidden `token` field and a submit button ("Confirm Cancellation") that `POST`s to `/api/booking/cancel`.
- Follow this repo's existing page styling conventions — read `src/app/booking/[code]/page.tsx` for the layout/class patterns to match.

**Verify**: `npx tsc --noEmit` → will still fail until Step 3 adds the `POST` handler — expected, continue.

### Step 3: Split `cancel/route.ts` into `GET` (redirect to confirm page) and `POST` (perform mutation)

Replace the current single `GET` handler in `src/app/api/booking/cancel/route.ts`:

```ts
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.redirect(new URL('/book?error=invalid_link', req.url))
  }
  return NextResponse.redirect(new URL(`/booking/confirm-cancel?token=${token}`, req.url))
  // Adjust path to match wherever Step 2's page actually lives, e.g.
  // /booking/[code]/cancel-confirm — but note the code isn't known at this
  // point without a lookup. Simplest: do the booking lookup here in GET too
  // (cheap, no mutation) purely to get the confirmation_code, then redirect
  // to /booking/${confirmation_code}/cancel-confirm?token=${token}.
  // If the token is invalid, keep today's existing error-redirect behavior.
}

export async function POST(req: NextRequest) {
  // Body: everything the current GET handler does today (lines 8-51 of the
  // original file), unchanged — token lookup, status/past-booking checks,
  // the update, email send, gcal delete, and the success redirect. Read
  // token from the POST body (form submission) instead of searchParams if
  // the confirm page submits a form — use `await req.formData()` and
  // `.get('token')`, matching how this repo's other form-posting routes
  // (if any) parse bodies, or accept it as a query param if the confirm
  // page's form action includes it in the URL — pick whichever is simpler
  // given how Step 2's form was built, and be consistent within this route.
}
```

Implement `GET` to do the token→booking lookup (read-only, no mutation) so it can redirect to the correctly-slugged confirm page. Implement `POST` with the exact logic the original `GET` had (lines 14-51 of the pre-change file), just renamed to the `POST` export.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 4: Same split for `reschedule/route.ts`

Apply the identical pattern to `src/app/api/booking/reschedule/route.ts`: `GET` looks up the booking and redirects to a reschedule confirm page (create `src/app/booking/[code]/reschedule-confirm/page.tsx` following the same pattern as Step 2, adjusted for reschedule copy/behavior — it redirects to `/book?rescheduled_from=...` on success instead of showing a cancelled state), `POST` performs the mutation (original lines 19-53).

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 5: Update every link found in Step 1

Update the email templates and any other link-generation code found in Step 1 to point at the new confirm pages (`/booking/[code]/cancel-confirm?token=...` and `/booking/[code]/reschedule-confirm?token=...`) instead of directly at the API routes. If `src/app/booking/[code]/page.tsx` has its own cancel/reschedule buttons, update those too.

**Verify**: `grep -rn "booking/cancel\|booking/reschedule" src/` → every remaining reference either is inside the new `GET` handlers (the redirect-to-confirm-page logic) or points at the new confirm pages, not directly at the API route as a raw link.

## Test plan

No existing tests cover these routes (confirmed: no `src/app/api/booking/__tests__` directory). This plan doesn't add automated tests (both routes are thin orchestration over already-tested primitives like `deleteGcalEvent`/`sendCancelEmail`); verify manually instead:

1. `pnpm dev`. Create a test booking (via `/book` flow or `pnpm seed`), get its `cancel_token` from the DB (Supabase dashboard, `bookings` table).
2. Visit `/api/booking/cancel?token=<token>` directly in a browser — confirm it redirects to the new confirm page (not an immediate cancellation) and the booking's `status` in the DB is still NOT `cancelled`.
3. On the confirm page, click "Confirm Cancellation" — confirm the booking's `status` becomes `cancelled` in the DB, the cancel email is attempted (check server logs / Resend dashboard), and you land on the expected success page.
4. Repeat steps 2-3 for reschedule.
5. Test the `already_cancelled` and `past_booking` error paths still redirect correctly (use an already-cancelled test booking, and a booking with `start_at` in the past).

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `npx tsc --noEmit` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test:run` exits 0 (no regressions)
- [ ] `grep -n "export async function POST" src/app/api/booking/cancel/route.ts src/app/api/booking/reschedule/route.ts` shows both files now export `POST`
- [ ] `grep -n "\.update({ status: 'cancelled' })" src/app/api/booking/cancel/route.ts src/app/api/booking/reschedule/route.ts` shows the mutation only happens inside `POST`, not `GET`
- [ ] No files outside the in-scope list are modified (`git status`)
- [ ] `plans/README.md` status row updated
- [ ] Manual verification steps 1-5 above completed and confirmed working

## STOP conditions

Stop and report back (do not improvise) if:

- The code at the locations in "Current state" doesn't match the excerpts (drift since this plan was written).
- Step 1's grep reveals the cancel/reschedule links are generated in more places than the email templates (e.g. SMS/Telegram messages per `HANDOFF.md`'s mention of Telegram alerts) — if so, list every location found and confirm they've all been updated before marking this done; don't leave any link pointing at the old direct-mutation `GET` behavior.
- `src/app/booking/[code]/page.tsx`'s existing structure makes it unclear how to slug the new confirm pages (e.g. if `[code]` dynamic routing conflicts with adding a further nested static segment) — report the exact routing structure found and propose an alternative path (e.g. `/booking/cancel-confirm?code=...&token=...` as a flat route) rather than forcing it.

## Maintenance notes

- Any future SMS/Telegram notification that includes a cancel/reschedule link (per the Phase 2a Telegram alerts work referenced in `HANDOFF.md`) must link to the new confirm pages, not the raw API routes — flag this for whoever implements Telegram alerts.
- A reviewer should click through the full manual test plan above before merging — this touches the customer-facing cancellation experience directly.
- The confirm pages don't require a login/session (by design — the `cancel_token` is the trust boundary, matching the existing reschedule route's documented rationale) — don't add an auth requirement here without a broader design discussion.
