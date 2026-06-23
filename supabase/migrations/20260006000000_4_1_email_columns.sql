-- Migration 4.1: email notification columns
-- Part of Danes Music Studio booking app — email layer (Phase 04)
-- Adds reminder_sent to bookings (idempotency guard for 24h cron reminder)
-- Adds reminder_enabled to settings (admin toggle, Phase 5 UI)

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false;

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT true;

-- Verify:
-- SELECT column_name, data_type, column_default FROM information_schema.columns
--   WHERE table_name = 'bookings' AND column_name = 'reminder_sent';
-- SELECT column_name, data_type, column_default FROM information_schema.columns
--   WHERE table_name = 'settings' AND column_name = 'reminder_enabled';
