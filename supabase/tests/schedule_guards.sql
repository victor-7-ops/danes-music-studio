-- Isolated synthetic rows and JWT claims; all writes roll back.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"role":"member"},"user_metadata":{"role":"admin"}}', true);
DO $$
BEGIN
  IF public.is_studio_admin() THEN RAISE EXCEPTION 'member accepted as admin'; END IF;
  BEGIN
    PERFORM public.create_admin_closure('2098-10-01 10:00+08','2098-10-01 11:00+08','TEST ONLY schedule guard',false);
    RAISE EXCEPTION 'member closure unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SELECT set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"role":"admin"}}', true);
DO $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_studio_admin() THEN RAISE EXCEPTION 'admin blocked'; END IF;
  result := public.create_admin_closure('2098-10-01 10:00+08','2098-10-01 11:00+08','TEST ONLY schedule guard',false);
  IF result->>'success' <> 'true' THEN RAISE EXCEPTION 'admin closure failed'; END IF;
  INSERT INTO special_hours(date,open_time,close_time,closed) VALUES('2098-10-01','09:00','22:00',false);
  UPDATE special_hours SET close_time='21:00' WHERE date='2098-10-01';
  DELETE FROM special_hours WHERE date='2098-10-01';
  DELETE FROM blocked_slots WHERE reason='TEST ONLY schedule guard';

  INSERT INTO bookings(service_type_id,start_at,end_at,customer_name,customer_phone,customer_email,total_amount,deposit_amount,confirmation_code,status,source,payment_method)
    SELECT id,'2098-10-02 10:00+08','2098-10-02 11:00+08','TEST ONLY schedule guard','09000000000','test@example.invalid',35000,17500,'GUARD-'||gen_random_uuid(),'confirmed','online','none'
    FROM service_types WHERE active LIMIT 1;
  result := public.create_admin_closure('2098-10-02 10:00+08','2098-10-02 11:00+08','TEST ONLY schedule guard',false);
  IF result->>'requiresConfirmation' <> 'true' THEN RAISE EXCEPTION 'closure conflict was missed'; END IF;
  BEGIN
    INSERT INTO blocked_slots(start_at,end_at,type,reason) VALUES('2098-10-02 10:00+08','2098-10-02 11:00+08','maintenance','TEST ONLY schedule guard');
    RAISE EXCEPTION 'overlapping closure accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'closure_conflicts_with_booking' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO special_hours(date,closed) VALUES('2098-10-02',true);
    RAISE EXCEPTION 'conflicting special hours accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'special_hours_conflicts_with_booking' THEN RAISE; END IF;
  END;
  result := public.create_admin_closure('2098-10-02 10:00+08','2098-10-02 11:00+08','TEST ONLY schedule guard',true);
  IF result->>'success' <> 'true' THEN RAISE EXCEPTION 'explicit forced closure failed'; END IF;
END $$;
ROLLBACK;
