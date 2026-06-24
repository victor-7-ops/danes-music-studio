-- Migration 7.2: Add gcal_event_id column to bookings
-- Part of Danes Music Studio booking app — Google Calendar sync (Phase 07)
-- Stores the Google Calendar event ID for confirmed bookings.
-- Used by push sync to update or delete the corresponding GCal event.
-- Null means either: GCal not connected, or booking not yet pushed to GCal.

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS gcal_event_id text;

-- Verify column added:
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'bookings' AND column_name = 'gcal_event_id';
