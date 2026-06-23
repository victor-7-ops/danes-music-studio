-- Migration: RLS admin write policies
-- Part of Danes Music Studio booking app
--
-- Context: Phase 2 added anon_read_* SELECT policies for the public booking flow.
-- This migration adds authenticated write (and full-read) policies for the admin panel.
--
-- Security notes:
--   - All policies use `TO authenticated` role qualifier, NOT auth.uid() IS NOT NULL.
--     This avoids auth function evaluation on anon requests and is the correct pattern
--     for a single-owner studio where any authenticated user is the owner.
--   - Existing anon_read_* policies from Phase 2 are NOT removed. Postgres OR-merges
--     permissive policies, so public booking routes continue to work unchanged.
--   - payments: admin gets SELECT only. Payments are written by the PayMongo webhook
--     via service role (bypasses RLS). Admin reads payments for audit trail only.
--   - bookings: FOR ALL gives admin full column access including PII (name, phone, email,
--     band_name, confirmation_code) which the anon policy intentionally excludes.

-- bookings: admin full access (INSERT/UPDATE/DELETE + unrestricted SELECT with PII)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'admin_all_bookings'
  ) THEN
    CREATE POLICY admin_all_bookings ON bookings
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- blocked_slots: admin full access
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'blocked_slots' AND policyname = 'admin_all_blocked_slots'
  ) THEN
    CREATE POLICY admin_all_blocked_slots ON blocked_slots
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- special_hours: admin full access
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'special_hours' AND policyname = 'admin_all_special_hours'
  ) THEN
    CREATE POLICY admin_all_special_hours ON special_hours
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- settings: admin full access
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'settings' AND policyname = 'admin_all_settings'
  ) THEN
    CREATE POLICY admin_all_settings ON settings
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- service_types: admin full access
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'service_types' AND policyname = 'admin_all_service_types'
  ) THEN
    CREATE POLICY admin_all_service_types ON service_types
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- payments: admin read-only (audit trail; writes go through service role via webhook)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'admin_read_payments'
  ) THEN
    CREATE POLICY admin_read_payments ON payments
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
