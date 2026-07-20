# 022 — Server-side content-type validation for QR/payment image upload

Planned at commit: `02be9c6`.

## Priority / Effort

P3 (admin-only surface, low blast radius, but cheap to fix) / S

## Problem

`src/app/admin/settings/SettingsClient.tsx:130-144` handles the payment
QR-code image upload:

```ts
if (!file.type.startsWith('image/')) { ... }
// ... storage path built using file.name.split('.').pop() ...
```

`file.type` is a client-reported, spoofable MIME type. The storage path
extension comes from `file.name`, also attacker-controlled. The file
uploads directly from the browser to Supabase Storage. This is an
admin-only surface (only an authenticated admin session can reach it), so
the realistic threat is a compromised/malicious admin session uploading a
non-image file with an image-like extension into the public payment-QR
bucket — low likelihood, but a cheap, standard hardening fix.

Before starting, check the Supabase Storage bucket's policy configuration
(search for bucket setup — likely in a migration file or Supabase dashboard
config not in this repo, note if it's not visible in-repo) to see if any
server-side content-type restriction already exists at the storage-policy
level. If one already exists there, this finding may already be handled at
the infra layer — verify and downgrade/close this plan if so rather than
adding redundant client-side-adjacent checks.

## Fix

Two complementary layers, do both if the storage-policy check above shows
nothing exists yet:

1. **Client-side (defense in depth, not the real fix)**: keep the existing
   `file.type.startsWith('image/')` check, but also validate the magic
   bytes aren't required here — skip, that's overkill for an admin-only
   upload widget.
2. **The actual fix — Supabase Storage bucket policy**: configure (via a
   migration or the Supabase dashboard, whichever this repo's convention
   uses for storage config — check `supabase/migrations/**` for any
   existing bucket-creation SQL) an `allowed_mime_types` restriction on the
   payment-QR bucket so Supabase Storage itself rejects non-image uploads
   server-side, regardless of what the client claims. This is the layer
   that actually matters since it can't be bypassed by a modified client
   request.

If no existing migration creates/configures this bucket in-repo (i.e. it was
set up manually via dashboard), add a new migration that sets
`allowed_mime_types` on it via `storage.buckets` update, and note in the
plan's completion that the dashboard config should be kept in sync going
forward — don't silently leave bucket config split between dashboard and
migrations without flagging it.

## Files in scope

- New Supabase migration file for the bucket's `allowed_mime_types` policy.
- `src/app/admin/settings/SettingsClient.tsx` only if you're also tightening
  the client-side extension-derivation logic (e.g. deriving the stored
  extension from the validated MIME type rather than trusting
  `file.name`'s extension) — optional, do it only if it's a small diff.

## Files explicitly out of scope

- Don't touch the Google Calendar or equipment panels in the same file.
- Don't add file-size limits or other unrelated upload hardening unless you
  find they're trivially missing and match this plan's scope — if you find
  a separate real gap, note it, don't silently expand.

## Verification

1. `npm run typecheck` passes.
2. Manual test: attempt to upload a non-image file (e.g. a renamed `.txt`
   file with a `.png` extension) via the settings UI, confirm it's rejected
   — either client-side (existing check) or, more importantly, server-side
   if you added the bucket policy (test by bypassing the client check via
   devtools/direct API call if feasible, to prove the server-side layer
   actually works).
3. Manual test: confirm a legitimate QR image (PNG/JPG) still uploads
   successfully.

## Done criteria

- Supabase Storage bucket for payment QR images enforces
  `allowed_mime_types` server-side (or documented confirmation that it
  already did, if the investigation step above found existing policy).
- Legitimate image uploads still work.

## Maintenance note

If bucket configuration lives outside this repo (dashboard-only), leave a
comment in the new migration (or in HANDOFF.md) noting that storage bucket
policy for `payment-qr` must be kept in sync manually if the dashboard is
ever used to reconfigure it.
