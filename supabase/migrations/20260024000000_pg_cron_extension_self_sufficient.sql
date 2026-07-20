-- pg_cron must be preloaded via Dashboard → Database → Extensions → pg_cron → Enable
-- (shared_preload_libraries change, cannot be done in a migration). Once preloaded,
-- CREATE EXTENSION here makes the schema self-sufficient across `db reset`,
-- which drops the extension along with the rest of the schema every run.
--
-- This is a standalone follow-up migration rather than an edit to
-- 20260004000000_3_4_pg_cron_hold_expiry.sql — that migration is already
-- applied on the live database, so editing it in place would not re-run and
-- would leave prod/staging silently diverged from a fresh `db reset`.
CREATE EXTENSION IF NOT EXISTS pg_cron;
