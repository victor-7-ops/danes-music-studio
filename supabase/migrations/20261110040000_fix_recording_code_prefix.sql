-- Fix: the user-facing "Recording" service actually stores as
-- service_types.name = 'Regular Tracking' (see src/lib/services.ts's
-- SERVICES.recording slug mapping) - the literal string 'Recording' is never
-- sent by any caller. The previous version of this function therefore always
-- produced DMS-RT... for Recording bookings and could never produce RC.
CREATE OR REPLACE FUNCTION public.generate_confirmation_code(p_service text)
RETURNS text LANGUAGE sql AS $$
  SELECT 'DMS-' || CASE p_service
    WHEN 'Regular Tracking' THEN 'RC'
    WHEN 'Recording' THEN 'RC'
    ELSE 'RE'
  END || string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', floor(random()*32)::int + 1, 1), ''
  ) FROM generate_series(1,3)
$$;
