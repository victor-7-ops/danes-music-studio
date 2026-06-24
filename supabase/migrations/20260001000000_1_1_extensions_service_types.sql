-- Migration 1.1: btree_gist extension + service_types table + seed
-- Safety net: btree_gist must be enabled in Dashboard before this runs.
-- If it is already enabled this is a no-op.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS service_types (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  rate_per_hour integer NOT NULL,
  deposit_pct   numeric(4, 3) NOT NULL DEFAULT 0.500,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS immediately; policies added in Phase 5.
ALTER TABLE service_types ENABLE ROW LEVEL SECURITY;

-- Seed: Rehearsal only (v1). rate = 35000 centavos (₱350/hr), deposit = 50%.
-- ON CONFLICT DO NOTHING makes re-running the migration safe.
INSERT INTO service_types (name, rate_per_hour, deposit_pct, active)
VALUES ('Rehearsal', 35000, 0.500, true)
ON CONFLICT DO NOTHING;
