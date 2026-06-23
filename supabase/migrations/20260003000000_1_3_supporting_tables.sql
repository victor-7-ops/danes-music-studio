-- Migration 1.3: blocked_slots, special_hours, settings (seeded), payments
-- Part of Danes Music Studio booking app data layer (Phase 01)

-- blocked_slots: manual closures and maintenance windows.
-- type CHECK prevents freeform values; enum not used here to allow future extension.
CREATE TABLE IF NOT EXISTS blocked_slots (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  start_at   timestamptz NOT NULL,
  end_at     timestamptz NOT NULL,
  reason     text,
  type       text        NOT NULL CHECK (type IN ('maintenance', 'owner_hold')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocked_slots_end_after_start CHECK (end_at > start_at)
);

ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;

-- special_hours: per-date operating hour overrides.
-- date UNIQUE: only one override per calendar date.
-- closed=true means no bookings that day regardless of open_time/close_time.
-- open_time/close_time nullable: not used when closed=true.
CREATE TABLE IF NOT EXISTS special_hours (
  id         uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  date       date    NOT NULL UNIQUE,
  open_time  time,
  close_time time,
  closed     boolean NOT NULL DEFAULT false
);

ALTER TABLE special_hours ENABLE ROW LEVEL SECURITY;

-- settings: single-row config for the studio.
-- operating_open / operating_close: default studio hours (Asia/Manila wall-clock).
-- hold_window_minutes: how long a pending online booking holds its slot (default 15).
-- default_deposit_pct: fallback if service_types row doesn't override (should match Rehearsal row).
CREATE TABLE IF NOT EXISTS settings (
  id                  uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  operating_open      time          NOT NULL DEFAULT '09:00',
  operating_close     time          NOT NULL DEFAULT '22:00',
  min_booking_minutes integer       NOT NULL DEFAULT 60,
  buffer_minutes      integer       NOT NULL DEFAULT 0,
  hold_window_minutes integer       NOT NULL DEFAULT 15,
  default_deposit_pct numeric(4, 3) NOT NULL DEFAULT 0.500
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Seed single settings row using idempotent DO block.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM settings LIMIT 1) THEN
    INSERT INTO settings DEFAULT VALUES;
  END IF;
END $$;

-- payments: one row per PayMongo payment attempt linked to a booking.
-- kind CHECK: full or deposit — matches payment_method_type enum values (without 'none').
-- amount is NUMERIC(10,2) — never FLOAT (CLAUDE.md invariant 3).
CREATE TABLE IF NOT EXISTS payments (
  id           uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id   uuid           NOT NULL REFERENCES bookings(id),
  provider     text           NOT NULL DEFAULT 'paymongo',
  provider_ref text,
  amount       numeric(10, 2) NOT NULL,
  kind         text           NOT NULL CHECK (kind IN ('full', 'deposit')),
  status       payment_status NOT NULL DEFAULT 'pending',
  created_at   timestamptz    NOT NULL DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
