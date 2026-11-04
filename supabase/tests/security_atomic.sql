-- Run only against a disposable local Supabase database after `supabase db reset`:
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/security_atomic.sql
-- This script opens a transaction and always rolls back. Never point it at production.
BEGIN;

DO $$
BEGIN
  IF has_table_privilege('anon','public.bookings','SELECT') THEN
    RAISE EXCEPTION 'anon unexpectedly has table-level SELECT on bookings';
  END IF;
  IF has_table_privilege('anon','public.bookings','INSERT') THEN
    RAISE EXCEPTION 'anon unexpectedly has table-level INSERT on bookings';
  END IF;
  IF has_function_privilege('anon','public.create_customer_reservations(jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute customer reservation RPC';
  END IF;
  IF has_function_privilege('authenticated','public.create_customer_reservations(jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'authenticated can execute customer reservation RPC';
  END IF;
  IF NOT has_function_privilege('service_role','public.create_customer_reservations(jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'service_role cannot execute customer reservation RPC';
  END IF;
  IF has_function_privilege('anon','public.reserve_equipment(uuid,timestamptz,timestamptz,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute equipment reservation RPC';
  END IF;
  IF NOT has_table_privilege('anon','public.settings','SELECT')
     OR NOT has_table_privilege('anon','public.service_types','SELECT') THEN
    RAISE EXCEPTION 'public catalogue/config read grants are missing';
  END IF;
END $$;

-- Successful transaction returns the capability and leaves exactly one booking.
DO $$
DECLARE result jsonb; code text; before_count bigint; after_count bigint;
BEGIN
  SELECT count(*) INTO before_count FROM bookings;
  result := public.create_customer_reservations(jsonb_build_object(
    'date','2099-01-01','start','10:00','end','11:00','service','Rehearsal','payment','deposit',
    'name','SQL Test','email','sql-test@example.invalid','phone','00000000','band','',
    'equipment_ids','[]'::jsonb,'occurrence_count',1,'occurrences','[]'::jsonb
  ));
  code := result->'codes'->>0;
  IF code IS NULL OR length(code) < 20 OR result->'tokens'->>0 IS NULL THEN
    RAISE EXCEPTION 'atomic RPC did not return a strong reference and capability';
  END IF;
  SELECT count(*) INTO after_count FROM bookings;
  IF after_count <> before_count + 1 THEN RAISE EXCEPTION 'expected exactly one inserted booking'; END IF;
END $$;

-- Exercise RLS with PostgREST-shaped JWT claims, without inserting real Auth users.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"member-test","role":"authenticated","app_metadata":{"role":"member"}}',true);
DO $$
DECLARE affected integer;
BEGIN
  IF EXISTS (SELECT 1 FROM bookings WHERE customer_email='sql-test@example.invalid') THEN
    RAISE EXCEPTION 'authenticated non-admin can read a customer booking';
  END IF;
  UPDATE settings SET default_deposit_pct=0.501;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'authenticated non-admin can write settings'; END IF;
  BEGIN
    PERFORM public.create_admin_closure('2099-01-03 12:00:00+08','2099-01-03 13:00:00+08','test',false);
    RAISE EXCEPTION 'authenticated non-admin can call admin closure RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SELECT set_config('request.jwt.claims','{"sub":"owner-test","role":"authenticated","app_metadata":{"role":"admin"}}',true);
DO $$
DECLARE affected integer; result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bookings WHERE customer_email='sql-test@example.invalid') THEN
    RAISE EXCEPTION 'trusted admin cannot read customer bookings';
  END IF;
  UPDATE settings SET default_deposit_pct=0.501;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected = 0 THEN RAISE EXCEPTION 'trusted admin cannot update settings'; END IF;
  result := public.create_admin_closure('2099-01-03 12:00:00+08','2099-01-03 13:00:00+08','test',false);
  IF result->>'success' <> 'true' THEN RAISE EXCEPTION 'trusted admin closure RPC did not insert'; END IF;
END $$;
RESET ROLE;

-- A blocked second weekly occurrence must roll back both the series and first occurrence.
DO $$
DECLARE before_bookings bigint; before_series bigint; after_bookings bigint; after_series bigint;
BEGIN
  INSERT INTO blocked_slots(start_at,end_at,type,reason)
  VALUES('2099-01-09 10:00:00+08','2099-01-09 11:00:00+08','maintenance','SQL atomic rollback check');
  SELECT count(*) INTO before_bookings FROM bookings;
  SELECT count(*) INTO before_series FROM booking_series;
  BEGIN
    PERFORM public.create_customer_reservations(jsonb_build_object(
      'date','2099-01-02','start','10:00','end','11:00','service','Rehearsal','payment','deposit',
      'name','Rollback Test','email','rollback@example.invalid','phone','00000000','band','',
      'equipment_ids','[]'::jsonb,'occurrence_count',2,'occurrences','[]'::jsonb
    ));
    RAISE EXCEPTION 'expected weekly schedule validation to fail';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'expected weekly schedule validation to fail' THEN RAISE; END IF;
  END;
  SELECT count(*) INTO after_bookings FROM bookings;
  SELECT count(*) INTO after_series FROM booking_series;
  IF after_bookings <> before_bookings OR after_series <> before_series THEN
    RAISE EXCEPTION 'failed weekly reservation left partial rows';
  END IF;
END $$;

ROLLBACK;
