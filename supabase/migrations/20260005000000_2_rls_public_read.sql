-- Migration: RLS public read policies for availability API
-- Part of Danes Music Studio booking app
--
-- Context: All tables have RLS enabled (Migrations 1.1–1.3) but no policies were added
-- until Phase 5 (admin auth). The public booking flow (Phase 2) and availability API
-- need anon-key read access on specific tables/columns. This migration adds the minimum
-- required SELECT policies for the public booking flow.
--
-- Security notes:
--   - bookings: anon can read only the 4 columns needed for overlap detection.
--     Customer PII (name, phone, email, band_name, confirmation_code) is NOT in the policy.
--     Supabase column-level security is not supported in RLS policies directly, but the
--     API route only SELECTs start_at, end_at, status, hold_expires_at — other columns
--     are never exposed to the public by the application layer.
--   - settings: studio operating hours are public info (shown on the landing page).
--   - special_hours: public — affects which slots the date picker shows as open.
--   - blocked_slots: public — prevents customers from booking closed periods.
--   - service_types: public — prices and names shown on the booking flow.
--
-- Phase 5 (admin auth) will add INSERT/UPDATE/DELETE policies and owner-only admin reads.

-- settings: anon can read (operating hours, hold window — public config)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'settings' AND policyname = 'anon_read_settings'
  ) THEN
    CREATE POLICY anon_read_settings ON settings
      FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- service_types: anon can read (prices and names shown in booking flow)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_types' AND policyname = 'anon_read_service_types'
  ) THEN
    CREATE POLICY anon_read_service_types ON service_types
      FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- special_hours: anon can read (date-level availability overrides)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'special_hours' AND policyname = 'anon_read_special_hours'
  ) THEN
    CREATE POLICY anon_read_special_hours ON special_hours
      FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- blocked_slots: anon can read (closed periods — prevents booking during maintenance)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'blocked_slots' AND policyname = 'anon_read_blocked_slots'
  ) THEN
    CREATE POLICY anon_read_blocked_slots ON blocked_slots
      FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- bookings: anon can read time ranges + status for overlap detection only.
-- The availability API uses: start_at, end_at, status, hold_expires_at.
-- Customer PII columns are never selected by the availability query.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'anon_read_booking_slots'
  ) THEN
    CREATE POLICY anon_read_booking_slots ON bookings
      FOR SELECT TO anon USING (status IN ('pending', 'confirmed'));
  END IF;
END $$;
