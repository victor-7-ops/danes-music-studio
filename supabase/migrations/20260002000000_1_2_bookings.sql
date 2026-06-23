-- Migration 1.2: ENUMs + bookings table + EXCLUDE double-booking constraint
-- Safety net: no-op if btree_gist already enabled from 01-01.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Native Postgres ENUMs (locked values from SPEC.md — do not alter).
CREATE TYPE booking_status      AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
CREATE TYPE booking_source      AS ENUM ('online', 'onsite', 'walk_in');
CREATE TYPE payment_status      AS ENUM ('pending', 'paid', 'failed', 'refunded');
CREATE TYPE payment_method_type AS ENUM ('full', 'deposit', 'none');

CREATE TABLE IF NOT EXISTS bookings (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type_id   uuid        NOT NULL REFERENCES service_types(id),
  start_at          timestamptz NOT NULL,
  end_at            timestamptz NOT NULL,
  band_name         text,
  customer_name     text        NOT NULL,
  customer_phone    text        NOT NULL,
  customer_email    text        NOT NULL,
  status            booking_status        NOT NULL DEFAULT 'pending',
  source            booking_source        NOT NULL DEFAULT 'online',
  payment_method    payment_method_type   NOT NULL DEFAULT 'none',
  payment_status    payment_status        NOT NULL DEFAULT 'pending',
  total_amount      numeric(10, 2) NOT NULL,
  deposit_amount    numeric(10, 2) NOT NULL,
  amount_paid       numeric(10, 2) NOT NULL DEFAULT 0,
  confirmation_code text        UNIQUE NOT NULL,
  hold_expires_at   timestamptz,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  -- Enforce whole-hour bookings and sane duration.
  CONSTRAINT bookings_end_after_start CHECK (end_at > start_at),

  -- DB-level double-booking guard. CRITICAL — do not remove.
  -- '[)' = inclusive start, exclusive end (standard scheduling: a booking ending at 14:00
  --        does NOT block one starting at 14:00).
  -- WHERE clause: only pending and confirmed rows participate.
  -- cancelled and completed are invisible to this constraint so historical rows
  -- never block new bookings.
  CONSTRAINT bookings_no_overlap
    EXCLUDE USING gist (
      tstzrange(start_at, end_at, '[)') WITH &&
    ) WHERE (status IN ('pending', 'confirmed'))
);

-- Enable RLS immediately. No policies until Phase 5 (admin auth).
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
