# Code quality review

## Standalone follow-up — November 6, 2026

Scope: `50160e6..0197888`, covering the two previous fixes and responsive bookings redesign, with current implementations, all four Calendar deletion callers, payment-action integration, and regression tests inspected. Documentation changes are included only for consistency. This is a scoped maintainability review, not a whole-system security audit.

Verdict: no new actionable maintainability findings in this diff. The previous two P2 findings are resolved. Calendar deletion now owns legacy/fallback event identity in the Calendar module, and the series action retains affected references and delivery messages through mixed-outcome drawer feedback.

The redesign keeps querying on the server and recovery interactions in the existing client component. Native disclosure and GET filters avoid extra state machinery; the filter key resets uncontrolled fields after client navigation. Money formatting and payment confirmation reuse existing code. No additional abstraction or dependency is warranted for this scope.

No changed source file exceeds 1,000 lines. The largest is `BookingDrawer.tsx` at 409 lines; the bookings page is 263 lines. Existing casts in Calendar event creation predate this diff and are not introduced by the identity fix.

Validation: 34 targeted regression tests passed across seven files: booking cancellation, series cancellation, customer cancellation/rescheduling, delivery retry, Calendar synchronization, drawer feedback, and recovery controls. Lint and TypeScript were not rerun because this task made documentation-only changes.

This review did not change application code, production data, Google authentication, or deployment settings. Live provider failures were not induced. The November 6 browser QA is recorded in `HANDOFF.md`; it is separate evidence, not a fresh full end-to-end run during this review.

---

## Historical review

Date: November 5, 2026

Scope: `0befe64..50160e6` (33 changed files). Reviewed the implementation, its callers, database migrations, and regression tests. This is a maintainability review of the recent changes, not a new whole-system security audit.

Verdict: Changes requested. Two P2 findings; no file-size blockers.

Follow-up: both findings have been addressed. Calendar deletion now resolves stored or derived event IDs inside `pushSync.ts`; all four callers pass booking identity. Series warnings retain the booking reference and original delivery messages, and the drawer displays them together with partial cancellation failures. All 31 targeted tests passed, including the new mixed-outcome action and drawer regressions. This follow-up has not had a separate standalone review.

Deployment follow-up, November 6: application commit `80b96e2` is deployed and verified READY. Live Calendar removal retries succeeded for both a cancelled test booking without a saved event ID and one with a saved legacy event ID. These were idempotent recovery checks on previously removed events; provider/database failures remain covered by regression tests rather than deliberate production faults. See `HANDOFF.md` for the current pickup state.

## P2 — Keep Calendar event identity inside the Calendar module

Location: `src/lib/actions/admin/retryBookingDelivery.ts:25`.

The persisted-ID-or-derived-ID rule now appears in four orchestration paths: admin cancellation, customer cancellation, customer rescheduling, and retry delivery. The insertion half of the same rule lives separately in `src/lib/gcal/pushSync.ts:64`. Controllers therefore need to know how Google event IDs are derived from booking IDs, even though the Calendar module owns creation and deletion.

This is an avoidable boundary leak. Changing the event ID format or its legacy fallback requires keeping five sites synchronized; an incomplete change could leave events that cancellation cannot find. Put persisted/derived identity resolution in the Calendar module and have the cancellation callers pass booking identity and the stored event ID. Keep authorization, request validation, legacy-ID support, and 404/410 handling intact. Do not introduce a generic integration framework.

Validation needed for the fix: the same canonical function should cover legacy stored IDs, deterministic IDs after an event-ID persistence failure, and repeated deletion.

## P2 — Preserve per-occurrence delivery issues when cancelling a series

Locations: `src/lib/actions/admin/cancelSeries.ts:46` and `src/components/admin/BookingDrawer.tsx:155`.

The series action reduces every delivery warning to one boolean, losing the affected booking and the original Calendar/email message. It then tells the admin to retry the affected occurrences without identifying them. If another occurrence also fails its database cancellation, the drawer takes its failure branch and drops the delivery warning entirely.

For example, cancellation A can commit but fail Calendar removal while cancellation B fails its database update. The action returns one failed ID and a generic warning, but the drawer shows only the cancellation-failure count. The admin cannot see that A also needs Calendar recovery.

Retain issues keyed by booking ID or confirmation code, preserve the delivery message, and show partial cancellation and delivery issues together. Reuse the existing per-booking cancellation behavior; do not duplicate its side effects or resend every occurrence merely to recover one failure.

Validation needed for the fix: add a mixed-outcome series test covering one committed cancellation with a delivery failure and a second cancellation with a database failure; assert that both issues reach the UI.

## Checks

- 27 targeted tests passed across cancellation, series cancellation, customer cancellation/rescheduling, delivery retry, and Calendar synchronization.
- No changed file reaches 1,000 lines. The largest is `BookingDrawer.tsx`, at 406 lines.
- No application code, production records, credentials, or deployments were changed during this review.
- The findings above are based on source and caller inspection; the existing targeted tests do not cover the mixed-outcome series case.

The deferred paid-plan password-protection setting was outside this review. No fresh live end-to-end run was performed.
