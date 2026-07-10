-- Migration: Phase 3 (simplified) — gear/equipment add-ons.
-- Admin manages a flat-price catalog in Settings; customer picks add-ons at
-- booking time; price is summed into the booking total server-side. No
-- separate assign/return/waitlist tracking (descoped from the original
-- roadmap plan per user request — keep it to catalog + price only).

CREATE TABLE equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price_per_session integer NOT NULL CHECK (price_per_session >= 0), -- centavos
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY anon_read_active_equipment ON equipment
  FOR SELECT TO anon
  USING (active);

CREATE POLICY admin_all_equipment ON equipment
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Junction: which equipment was added to which booking, with a price snapshot
-- (so later admin price changes don't retroactively alter past bookings).
CREATE TABLE booking_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES equipment(id),
  price_at_booking integer NOT NULL CHECK (price_at_booking >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE booking_equipment ENABLE ROW LEVEL SECURITY;

-- Scoped like the anon booking INSERT policy: only allowed alongside a
-- booking the anon request itself just created (still pending/online).
CREATE POLICY anon_insert_booking_equipment ON booking_equipment
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings b
      WHERE b.id = booking_id AND b.status = 'pending' AND b.source = 'online'
    )
  );

CREATE POLICY admin_all_booking_equipment ON booking_equipment
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
