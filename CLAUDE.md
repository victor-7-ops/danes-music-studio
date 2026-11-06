# Project pickup and continuity

Read `HANDOFF.md` before making changes. It records the current application commit, deployment, verification evidence, production project, and deferred decisions. Use `README.md` for setup and `CODE_QUALITY_REVIEW.md` for the recent review history.

Keep `HANDOFF.md` current whenever code, deployment state, tests, decisions, or pending work change. Update it in the same commit when possible. Distinguish prior evidence from checks performed in the current session, and never claim zero bugs.

Preserve these constraints:

- Money uses integer centavos; scheduling uses Asia/Manila.
- Manual QR/bank transfer is active; PayMongo remains unwired.
- Admin access uses trusted app metadata and RLS. Preserve validation and error handling.
- Check the database target before running fixtures: the local environment has used production Supabase.
- Keep secrets and credential values out of source, logs, documentation, and commits. Preserve the existing Google Calendar connection; do not sign out the studio profile during routine testing.
- Keep commits free of assistant attribution and coauthor trailers.
- Leaked-password protection and branded email sender work are deferred by Victor; do not change billing or reopen these decisions unprompted.
- Follow Victor's review gates: the standalone `$thermo-nuclear-code-quality-review` requires explicit invocation. Use Thermos only for a change he labels medium-risk, and flag any encountered file over 1,000 lines.

Prefer the smallest complete fix, reuse the existing project patterns, and test the behavior affected by the change. Check `git status` before staging so unrelated local reports are preserved.
