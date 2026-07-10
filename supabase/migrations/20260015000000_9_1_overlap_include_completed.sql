-- Migration 9.1: Close walk-in double-booking race.
-- Walk-ins insert as status='completed', which the original bookings_no_overlap
-- constraint ignored — leaving only an app-level overlap check (race window).
-- Recreate the constraint so every non-cancelled row participates. Historical
-- completed rows can't collide with future ranges, so this is safe for old data
-- unless genuinely overlapping completed rows already exist (checked below).

DO $$
DECLARE
  bad_count integer;
BEGIN
  SELECT count(*) INTO bad_count
  FROM bookings a
  JOIN bookings b
    ON a.id < b.id
   AND a.status <> 'cancelled'
   AND b.status <> 'cancelled'
   AND tstzrange(a.start_at, a.end_at, '[)') && tstzrange(b.start_at, b.end_at, '[)');

  IF bad_count > 0 THEN
    RAISE EXCEPTION
      'Found % overlapping non-cancelled booking pair(s). Resolve (cancel one of each pair) before applying this migration.',
      bad_count;
  END IF;
END $$;

ALTER TABLE bookings DROP CONSTRAINT bookings_no_overlap;

-- '[)' semantics unchanged: a booking ending at 14:00 does not block one starting at 14:00.
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (status <> 'cancelled');
