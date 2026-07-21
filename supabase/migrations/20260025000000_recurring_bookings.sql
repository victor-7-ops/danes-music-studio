-- Migration: recurring bookings (plan 031)
-- New booking_series table + nullable bookings.series_id FK.
-- Money fields stay on individual bookings rows (Option B — per-occurrence
-- payment, see plans/013a-recurring-bookings-design.md Q4/Q6). Do not add
-- money fields to booking_series.

CREATE TABLE booking_series (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recurrence_pattern text        NOT NULL DEFAULT 'weekly' CHECK (recurrence_pattern = 'weekly'),
  occurrence_count   integer     NOT NULL CHECK (occurrence_count > 0 AND occurrence_count <= 26),
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bookings ADD COLUMN series_id uuid REFERENCES booking_series(id);
CREATE INDEX bookings_series_id_idx ON bookings(series_id) WHERE series_id IS NOT NULL;

-- RLS: same shape as bookings/booking_equipment (anon can create pending
-- online bookings; authenticated/admin can do anything). booking_series
-- itself carries no customer or money data, so anon insert is unrestricted
-- beyond "must exist to be referenced by a pending bookings row" — the FK
-- from bookings enforces that relationship.
ALTER TABLE booking_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY anon_insert_booking_series ON booking_series
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY anon_read_booking_series ON booking_series
  FOR SELECT TO anon
  USING (true);

CREATE POLICY admin_all_booking_series ON booking_series
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
