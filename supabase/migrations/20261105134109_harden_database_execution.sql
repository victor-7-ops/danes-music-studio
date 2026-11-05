CREATE OR REPLACE FUNCTION public.lock_studio_schedule_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('studio-reservations-and-closures', 0));
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  -- Resolve NEW fields only inside the branch for their table's row type.
  IF TG_TABLE_NAME = 'blocked_slots' THEN
    IF current_setting('app.force_confirmed_closure', true) IS DISTINCT FROM 'on' AND EXISTS (
      SELECT 1 FROM bookings b WHERE b.status IN ('pending','confirmed','completed')
        AND tstzrange(b.start_at,b.end_at,'[)') && tstzrange(NEW.start_at,NEW.end_at,'[)')
    ) THEN RAISE EXCEPTION 'closure_conflicts_with_booking'; END IF;
  ELSIF TG_TABLE_NAME = 'special_hours' THEN
    IF EXISTS (
      SELECT 1 FROM bookings b WHERE b.status IN ('pending','confirmed','completed')
        AND (b.start_at AT TIME ZONE 'Asia/Manila')::date = NEW.date
        AND (NEW.closed OR (NEW.open_time IS NOT NULL AND (b.start_at AT TIME ZONE 'Asia/Manila')::time < NEW.open_time)
          OR (NEW.close_time IS NOT NULL AND (b.end_at AT TIME ZONE 'Asia/Manila')::time > NEW.close_time))
    ) THEN RAISE EXCEPTION 'special_hours_conflicts_with_booking'; END IF;
  END IF;
  RETURN NEW;
END $$;

-- Both functions can rely on the existing admin RLS policies and role check.
ALTER FUNCTION public.is_studio_admin() SECURITY INVOKER;
ALTER FUNCTION public.create_admin_closure(timestamptz,timestamptz,text,boolean) SECURITY INVOKER;

ALTER EXTENSION btree_gist SET SCHEMA extensions;

-- pg_net is not relocatable; never recreate it while requests are queued.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_net' AND n.nspname='public') THEN
    IF EXISTS (SELECT 1 FROM net.http_request_queue) THEN
      RAISE EXCEPTION 'Drain queued HTTP requests before relocating pg_net';
    END IF;
    DROP EXTENSION pg_net;
    CREATE EXTENSION pg_net WITH SCHEMA extensions;
  END IF;
END $$;
