-- Migration 7.1b: blocked_slots schema changes for GCal pull sync
-- Part of Danes Music Studio booking app — Google Calendar sync (Phase 07)
-- (a) Extends type CHECK constraint to include 'gcal' (D-15, Option A)
-- (b) Adds external_id column for idempotent GCal event upsert (D-16)

-- Section A: extend type CHECK constraint to include 'gcal'
-- Original constraint (from 20260003000000_1_3_supporting_tables.sql):
--   CHECK (type IN ('maintenance', 'owner_hold'))  -- auto-named blocked_slots_type_check
-- Wrapped in DO $$ for idempotency: DROP IF EXISTS then re-add with 'gcal' added.
DO $$ BEGIN
  ALTER TABLE blocked_slots DROP CONSTRAINT IF EXISTS blocked_slots_type_check;
  ALTER TABLE blocked_slots ADD CONSTRAINT blocked_slots_type_check
    CHECK (type IN ('maintenance', 'owner_hold', 'gcal'));
END $$;

-- Section B: add external_id column (inherently idempotent with IF NOT EXISTS)
-- Stores the Google Calendar event ID for idempotent upsert in pullSync.ts
ALTER TABLE blocked_slots ADD COLUMN IF NOT EXISTS external_id text;

-- Section C: partial unique index (idempotent with IF NOT EXISTS)
-- Prevents duplicate blocked_slots rows for the same GCal event
CREATE UNIQUE INDEX IF NOT EXISTS blocked_slots_external_id_idx
  ON blocked_slots (external_id)
  WHERE external_id IS NOT NULL;

-- Verify constraint updated:
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'blocked_slots_type_check';
--
-- Verify column added:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'blocked_slots' AND column_name = 'external_id';
--
-- Verify unique index:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'blocked_slots' AND indexname = 'blocked_slots_external_id_idx';
--
-- Test constraint accepts 'gcal':
-- INSERT INTO blocked_slots (type, start_at, end_at) VALUES ('gcal', now(), now() + interval '1 hour');
-- DELETE FROM blocked_slots WHERE type = 'gcal' AND start_at > now() - interval '1 minute';
