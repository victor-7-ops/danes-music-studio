# 024 — Fix README's stale PayMongo payment flow description

Planned at commit: `02be9c6`.

## Priority / Effort

P2 (onboarding correctness — wrong instructions for anyone new to the repo) / S

## Problem

`README.md` describes a live PayMongo GCash checkout flow:

- Opening product description says customers "pay a deposit via PayMongo
  GCash."
- The smoke-test section instructs reaching "PayMongo GCash checkout" and
  using "PayMongo test credentials to complete payment."
- The Vercel deploy env-var table tells a deployer to register a PayMongo
  webhook and set `PAYMONGO_SECRET_KEY`/`PAYMONGO_WEBHOOK_SECRET`.

`HANDOFF.md:44` states explicitly: **"PayMongo is OFF... Manual QR + proof
upload (Phase 2c) is the only active payment path."** This is a direct
contradiction between two committed docs, and README is the more likely
first-read for anyone onboarding — they'll be told to test/configure a
payment path that doesn't run in production.

Read the actual current README.md and HANDOFF.md sections yourself before
editing to confirm exact current wording (this plan was written from an
audit summary, not a full README read — verify line numbers and exact
phrasing before making changes).

## Fix

1. Update README's product description to describe the manual QR + proof
   upload flow (Phase 2c) as the live payment path, matching HANDOFF.md's
   description.
2. Update the smoke-test section: replace PayMongo GCash checkout steps
   with the actual manual-QR-upload flow steps — walk through what a
   customer actually does today (view QR code, upload payment proof, admin
   confirms via `confirmDeposit`) to write accurate smoke-test steps. If
   unsure of the exact customer-facing flow, trace it from the code (find
   the customer-facing booking confirmation page and payment-proof upload
   component) rather than guessing.
3. Update the Vercel deploy env-var table: remove or clearly mark
   `PAYMONGO_SECRET_KEY`/`PAYMONGO_WEBHOOK_SECRET` as "not currently
   required — PayMongo integration exists in code but is intentionally
   unwired; keep these unset unless re-enabling it" rather than presenting
   them as required for a working deploy.

Do not delete PayMongo-related code or env var *support* — per
`plans/README.md`'s existing rejected-findings note, PayMongo being unwired
is a deliberate product decision, not a bug to fix. This plan only corrects
the *documentation* to match that decision.

## Files in scope

- `README.md` only.

## Files explicitly out of scope

- `HANDOFF.md` — separate plan (025) handles that; don't merge scope.
- Any PayMongo integration code (`src/lib/paymongo/**` or similar, if it
  exists) — out of scope, this is a docs-only plan.

## Verification

1. Read the updated README top to bottom and confirm every payment-related
   sentence matches the actual current manual-QR-upload flow, not PayMongo.
2. If the smoke-test steps are followed manually against a local dev
   instance, confirm they actually work as written (this is the real test
   — a doc fix that describes a flow you haven't verified is just a
   different kind of stale).

## Done criteria

- No remaining README references describing PayMongo as the live/active
  payment path.
- Smoke-test steps accurately describe the manual QR + proof-upload flow.
- Deploy env-var table correctly marks PayMongo vars as optional/inactive.

## Maintenance note

If PayMongo is ever re-enabled (explicitly flagged as out of scope
elsewhere), README will need a follow-up update at that time — this plan
doesn't need to anticipate that, just needs to be accurate for the current
state.
