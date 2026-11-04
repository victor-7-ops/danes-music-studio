-- Security boundary and transactionally complete customer reservations.
-- The service role is the only caller of create_customer_reservations().
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.is_studio_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;
REVOKE ALL ON FUNCTION public.is_studio_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_studio_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.create_customer_reservations(p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_count integer := (p_request->>'occurrence_count')::integer;
  v_start time := (p_request->>'start')::time;
  v_end time := (p_request->>'end')::time;
  v_date date := (p_request->>'date')::date;
  v_service service_types%ROWTYPE;
  v_settings settings%ROWTYPE;
  v_i integer;
  v_day date;
  v_open time;
  v_close time;
  v_id uuid;
  v_code text;
  v_codes jsonb := '[]'::jsonb;
  v_tokens jsonb := '[]'::jsonb;
  v_equipment jsonb;
  v_item jsonb;
  v_hours integer;
  v_total integer;
  v_deposit integer;
  v_equipment_total integer;
  v_hold timestamptz;
  v_session_start timestamptz;
  v_session_end timestamptz;
  v_series uuid;
  v_active_count integer;
  v_qty integer;
  v_price integer;
  v_constraint text;
  v_code_attempts integer;
BEGIN
  IF jsonb_typeof(p_request) <> 'object'
     OR p_request->>'service' NOT IN ('Rehearsal','Recording','Regular Tracking')
     OR p_request->>'payment' NOT IN ('full','deposit')
     OR v_count IS NULL OR v_count < 1 OR v_count > 26
     OR v_date IS NULL
     OR (SELECT count(*) FROM jsonb_array_elements_text(coalesce(p_request->'equipment_ids','[]'::jsonb))) > 20
     OR v_start IS NULL OR v_end IS NULL OR v_start >= v_end
     OR date_part('minute', v_start) <> 0 OR date_part('minute', v_end) <> 0
     OR v_end - v_start < interval '1 hour'
     OR length(trim(coalesce(p_request->>'name',''))) < 2
     OR length(trim(coalesce(p_request->>'phone',''))) < 7
     OR (p_request->>'email') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  THEN RAISE EXCEPTION 'invalid_booking_parameters' USING ERRCODE = '22023'; END IF;

  -- Serialize schedule/config writes before deriving the immutable booking snapshot.
  PERFORM pg_advisory_xact_lock(hashtextextended('studio-reservations-and-closures', 0));
  SELECT * INTO v_service FROM service_types WHERE name = p_request->>'service' AND active FOR SHARE;
  SELECT * INTO v_settings FROM settings LIMIT 1 FOR SHARE;
  IF v_service.id IS NULL OR v_settings.id IS NULL THEN RAISE EXCEPTION 'service_configuration_error'; END IF;
  IF p_request->>'service' = 'Rehearsal' AND (v_settings.operating_open IS NULL OR v_settings.operating_close IS NULL) THEN
    RAISE EXCEPTION 'schedule_configuration_error';
  END IF;

  v_equipment := coalesce(p_request->'equipment_ids', '[]'::jsonb);
  IF jsonb_typeof(v_equipment) <> 'array' OR jsonb_array_length(v_equipment) > 20 THEN
    RAISE EXCEPTION 'invalid_equipment';
  END IF;
  IF (SELECT count(DISTINCT value::uuid) FROM jsonb_array_elements_text(v_equipment)) < jsonb_array_length(v_equipment) THEN
    RAISE EXCEPTION 'duplicate_equipment';
  END IF;
  -- Lock catalog prices in deterministic order before calculating totals and
  -- storing the same values as junction snapshots.
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_equipment) ORDER BY value::text LOOP
    SELECT price_per_session INTO v_price FROM equipment
      WHERE id=(v_item #>> '{}')::uuid AND active FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'equipment_unavailable'; END IF;
  END LOOP;
  SELECT coalesce(sum(e.price_per_session),0) INTO v_equipment_total
    FROM equipment e JOIN (SELECT DISTINCT value::uuid AS id FROM jsonb_array_elements_text(v_equipment)) q ON q.id=e.id
    WHERE e.active;

  UPDATE bookings SET status='cancelled', updated_at=now()
    WHERE status='pending' AND hold_expires_at IS NOT NULL AND hold_expires_at <= now();

  v_hours := extract(epoch FROM (v_end-v_start))/3600;
  v_total := (v_hours * v_service.rate_per_hour) + v_equipment_total;
  v_deposit := floor(v_total * v_service.deposit_pct)::integer;
  v_hold := now() + make_interval(mins => v_settings.hold_window_minutes);
  IF v_count > 1 THEN
    INSERT INTO booking_series(recurrence_pattern, occurrence_count) VALUES ('weekly',v_count) RETURNING id INTO v_series;
  END IF;

  FOR v_i IN 0..v_count-1 LOOP
    v_day := v_date + (v_i * 7);
    v_session_start := (v_day::text || ' ' || v_start::text)::timestamp AT TIME ZONE 'Asia/Manila';
    v_session_end := (v_day::text || ' ' || v_end::text)::timestamp AT TIME ZONE 'Asia/Manila';
    IF v_session_start <= now() THEN RAISE EXCEPTION 'booking_must_be_future'; END IF;
    SELECT coalesce(sh.open_time,v_settings.operating_open),
           coalesce(sh.close_time,v_settings.operating_close)
      INTO v_open,v_close FROM (SELECT 1) x LEFT JOIN special_hours sh ON sh.date=v_day;
    IF EXISTS (SELECT 1 FROM special_hours WHERE date=v_day AND closed) THEN RAISE EXCEPTION 'studio_closed'; END IF;
    IF v_open IS NULL OR v_close IS NULL OR v_start < v_open OR v_end > v_close THEN RAISE EXCEPTION 'outside_operating_hours'; END IF;
    IF EXISTS (SELECT 1 FROM blocked_slots b WHERE tstzrange(b.start_at,b.end_at,'[)') && tstzrange(v_session_start,v_session_end,'[)')) THEN
      RAISE EXCEPTION 'slot_blocked';
    END IF;
    IF EXISTS (SELECT 1 FROM bookings b WHERE b.status IN ('pending','confirmed','completed')
      AND tstzrange(b.start_at,b.end_at,'[)') && tstzrange(v_session_start,v_session_end,'[)')) THEN
      RAISE EXCEPTION 'bookings_no_overlap';
    END IF;

    v_code_attempts := 0;
    LOOP
      v_code := 'DMS-' || upper(replace(gen_random_uuid()::text,'-',''));
      BEGIN
        INSERT INTO bookings(confirmation_code,customer_name,customer_email,customer_phone,band_name,start_at,end_at,service_type_id,status,source,hold_expires_at,total_amount,deposit_amount,amount_paid,payment_method,series_id)
          VALUES(v_code,trim(p_request->>'name'),trim(p_request->>'email'),trim(p_request->>'phone'),nullif(trim(coalesce(p_request->>'band','')),''),v_session_start,v_session_end,v_service.id,'pending','online',v_hold,v_total,v_deposit,0,(p_request->>'payment')::payment_method_type,v_series)
          RETURNING id INTO v_id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint <> 'bookings_confirmation_code_key' OR v_code_attempts >= 4 THEN RAISE; END IF;
        v_code_attempts := v_code_attempts + 1;
      END;
    END LOOP;

    FOR v_item IN SELECT value FROM jsonb_array_elements(v_equipment) ORDER BY value::text LOOP
      SELECT quantity INTO v_qty FROM equipment WHERE id=(v_item #>> '{}')::uuid AND active FOR UPDATE;
      IF v_qty IS NULL THEN RAISE EXCEPTION 'equipment_unavailable'; END IF;
      PERFORM pg_advisory_xact_lock(hashtextextended((v_item #>> '{}'),0));
      SELECT count(*) INTO v_active_count FROM booking_equipment be JOIN bookings b ON b.id=be.booking_id
        WHERE be.equipment_id=(v_item #>> '{}')::uuid AND b.status IN ('pending','confirmed','completed')
          AND tstzrange(b.start_at,b.end_at,'[)') && tstzrange(v_session_start,v_session_end,'[)');
      IF v_active_count >= v_qty THEN RAISE EXCEPTION 'equipment_unavailable'; END IF;
      INSERT INTO booking_equipment(booking_id,equipment_id,price_at_booking)
        SELECT v_id,e.id,e.price_per_session FROM equipment e WHERE e.id=(v_item #>> '{}')::uuid AND e.active;
    END LOOP;
    v_codes := v_codes || to_jsonb(v_code);
    v_tokens := v_tokens || to_jsonb((SELECT cancel_token FROM bookings WHERE id=v_id));
  END LOOP;
  RETURN jsonb_build_object('codes',v_codes,'tokens',v_tokens,'series_id',v_series,'hold_expires_at',v_hold);
END;
$$;
REVOKE ALL ON FUNCTION public.create_customer_reservations(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_reservations(jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.create_admin_closure(
  p_start_at timestamptz, p_end_at timestamptz, p_reason text, p_force boolean DEFAULT false
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_conflicts jsonb;
BEGIN
  IF NOT public.is_studio_admin() THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501'; END IF;
  IF p_start_at IS NULL OR p_end_at IS NULL OR p_start_at >= p_end_at THEN RAISE EXCEPTION 'invalid_date_range' USING ERRCODE='22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('studio-reservations-and-closures',0));
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',b.id,'confirmation_code',b.confirmation_code,
    'band_name',b.band_name,'customer_name',b.customer_name,'start_at',b.start_at,'end_at',b.end_at)), '[]'::jsonb)
    INTO v_conflicts FROM bookings b WHERE b.status IN ('pending','confirmed','completed')
      AND tstzrange(b.start_at,b.end_at,'[)') && tstzrange(p_start_at,p_end_at,'[)');
  IF jsonb_array_length(v_conflicts)>0 AND NOT coalesce(p_force,false) THEN
    RETURN jsonb_build_object('success',false,'requiresConfirmation',true,'conflicts',v_conflicts);
  END IF;
  IF coalesce(p_force,false) THEN PERFORM set_config('app.force_confirmed_closure','on',true); END IF;
  INSERT INTO blocked_slots(start_at,end_at,reason,type) VALUES(p_start_at,p_end_at,p_reason,'maintenance');
  RETURN jsonb_build_object('success',true);
END $$;
REVOKE ALL ON FUNCTION public.create_admin_closure(timestamptz,timestamptz,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_admin_closure(timestamptz,timestamptz,text,boolean) TO authenticated;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_claimed_at timestamptz;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS reminder_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE settings ADD CONSTRAINT settings_whole_hour_window
  CHECK (date_part('minute', operating_open)=0 AND date_part('second', operating_open)=0
    AND date_part('minute', operating_close)=0 AND date_part('second', operating_close)=0
    AND operating_open < operating_close) NOT VALID;
ALTER TABLE special_hours ADD CONSTRAINT special_hours_whole_hour_window
  CHECK (closed OR (open_time IS NULL OR (date_part('minute',open_time)=0 AND date_part('second',open_time)=0))
    AND (close_time IS NULL OR (date_part('minute',close_time)=0 AND date_part('second',close_time)=0))
    AND (open_time IS NULL OR close_time IS NULL OR open_time < close_time)) NOT VALID;
CREATE OR REPLACE FUNCTION public.claim_booking_reminders(p_start timestamptz, p_end timestamptz)
RETURNS SETOF bookings LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  WITH candidates AS (
    SELECT id FROM bookings WHERE status='confirmed' AND reminder_sent=false
      AND start_at >= p_start AND start_at <= p_end
      AND (reminder_claimed_at IS NULL OR reminder_claimed_at < now()-interval '5 minutes')
    ORDER BY start_at FOR UPDATE SKIP LOCKED LIMIT 100
  )
  UPDATE bookings b SET reminder_claimed_at=now(), reminder_attempts=reminder_attempts+1
    FROM candidates c WHERE b.id=c.id RETURNING b.*;
$$;
REVOKE ALL ON FUNCTION public.claim_booking_reminders(timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_booking_reminders(timestamptz,timestamptz) TO service_role;

-- Remove every older permissive policy and explicitly define access.
DO $$ DECLARE p record; BEGIN
  FOR p IN SELECT schemaname,tablename,policyname FROM pg_policies WHERE schemaname='public'
    AND tablename IN ('bookings','booking_series','booking_equipment','payments','google_tokens','blocked_slots','special_hours','settings','service_types','equipment')
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',p.policyname,p.schemaname,p.tablename); END LOOP;
END $$;
CREATE POLICY admin_bookings ON bookings FOR ALL TO authenticated USING (public.is_studio_admin()) WITH CHECK (public.is_studio_admin());
CREATE POLICY admin_booking_series ON booking_series FOR ALL TO authenticated USING (public.is_studio_admin()) WITH CHECK (public.is_studio_admin());
CREATE POLICY admin_booking_equipment ON booking_equipment FOR ALL TO authenticated USING (public.is_studio_admin()) WITH CHECK (public.is_studio_admin());
CREATE POLICY admin_blocked_slots ON blocked_slots FOR ALL TO authenticated USING (public.is_studio_admin()) WITH CHECK (public.is_studio_admin());
CREATE POLICY admin_special_hours ON special_hours FOR ALL TO authenticated USING (public.is_studio_admin()) WITH CHECK (public.is_studio_admin());
CREATE POLICY admin_settings ON settings FOR ALL TO authenticated USING (public.is_studio_admin()) WITH CHECK (public.is_studio_admin());
CREATE POLICY admin_service_types ON service_types FOR ALL TO authenticated USING (public.is_studio_admin()) WITH CHECK (public.is_studio_admin());
CREATE POLICY admin_equipment ON equipment FOR ALL TO authenticated USING (public.is_studio_admin()) WITH CHECK (public.is_studio_admin());
CREATE POLICY admin_payments ON payments FOR ALL TO authenticated USING (public.is_studio_admin()) WITH CHECK (public.is_studio_admin());
CREATE POLICY admin_google_tokens ON google_tokens FOR ALL TO authenticated USING (public.is_studio_admin()) WITH CHECK (public.is_studio_admin());
CREATE POLICY public_settings_read ON settings FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY public_services_read ON service_types FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY public_special_hours_read ON special_hours FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY public_blocked_slots_read ON blocked_slots FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY public_active_equipment_read ON equipment FOR SELECT TO anon,authenticated USING (active);

REVOKE ALL ON bookings,booking_series,booking_equipment,payments,google_tokens FROM anon, PUBLIC;
GRANT SELECT,INSERT,UPDATE,DELETE ON bookings,booking_series,booking_equipment,payments,google_tokens TO authenticated;
GRANT SELECT ON settings,service_types,special_hours,blocked_slots,equipment TO anon,authenticated;
GRANT INSERT,UPDATE,DELETE ON settings,service_types,special_hours,blocked_slots,equipment TO authenticated;
REVOKE ALL ON FUNCTION reserve_equipment(uuid,timestamptz,timestamptz,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION reserve_equipment(uuid,timestamptz,timestamptz,jsonb) TO service_role;

-- Storage access for customer proof uploads is mediated by the service route only.
DROP POLICY IF EXISTS payment_proofs_admin_read ON storage.objects;
DROP POLICY IF EXISTS payment_qr_admin_write ON storage.objects;
DROP POLICY IF EXISTS payment_qr_admin_update ON storage.objects;
CREATE POLICY payment_proofs_admin_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id='payment-proofs' AND public.is_studio_admin());
CREATE POLICY payment_qr_admin_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id='payment-qr' AND public.is_studio_admin());
CREATE POLICY payment_qr_admin_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id='payment-qr' AND public.is_studio_admin())
  WITH CHECK (bucket_id='payment-qr' AND public.is_studio_admin());
REVOKE INSERT,UPDATE,DELETE ON storage.objects FROM anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;

-- The schedule lock also serializes closure creation/editing with reservation.
CREATE OR REPLACE FUNCTION public.lock_studio_schedule_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('studio-reservations-and-closures',0));
  IF TG_OP <> 'DELETE' AND TG_TABLE_NAME = 'blocked_slots'
    AND current_setting('app.force_confirmed_closure',true) IS DISTINCT FROM 'on' AND EXISTS (
    SELECT 1 FROM bookings b WHERE b.status IN ('pending','confirmed','completed')
      AND tstzrange(b.start_at,b.end_at,'[)') && tstzrange(NEW.start_at,NEW.end_at,'[)')
  ) THEN RAISE EXCEPTION 'closure_conflicts_with_booking'; END IF;
  IF TG_OP <> 'DELETE' AND TG_TABLE_NAME = 'special_hours' AND EXISTS (
    SELECT 1 FROM bookings b WHERE b.status IN ('pending','confirmed','completed')
      AND (b.start_at AT TIME ZONE 'Asia/Manila')::date = NEW.date
      AND (NEW.closed OR (NEW.open_time IS NOT NULL AND (b.start_at AT TIME ZONE 'Asia/Manila')::time < NEW.open_time)
        OR (NEW.close_time IS NOT NULL AND (b.end_at AT TIME ZONE 'Asia/Manila')::time > NEW.close_time))
  ) THEN RAISE EXCEPTION 'special_hours_conflicts_with_booking'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER lock_blocked_slots_write BEFORE INSERT OR UPDATE OR DELETE ON blocked_slots FOR EACH ROW EXECUTE FUNCTION public.lock_studio_schedule_write();
CREATE TRIGGER lock_special_hours_write BEFORE INSERT OR UPDATE OR DELETE ON special_hours FOR EACH ROW EXECUTE FUNCTION public.lock_studio_schedule_write();

-- Explicit table grants; policies alone do not grant SQL operations.
GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
GRANT SELECT ON settings,service_types,special_hours,blocked_slots,equipment TO anon;
GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO service_role;
