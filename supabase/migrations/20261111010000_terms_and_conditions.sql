-- Admin-editable Terms & Conditions, shown to the customer on the review
-- step and required before a booking can be created. Each booking snapshots
-- the text (and acceptance time) it was shown, so later edits to the live
-- text don't retroactively change what an existing booking agreed to.
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS terms_and_conditions text NOT NULL DEFAULT '';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS terms_accepted_text text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;

CREATE OR REPLACE FUNCTION public.update_studio_settings(p_settings jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  settings_id uuid;
  opening time := (p_settings->>'operating_open')::time;
  closing time := (p_settings->>'operating_close')::time;
  hold_minutes integer := (p_settings->>'hold_window_minutes')::integer;
  deposit numeric := (p_settings->>'default_deposit_pct')::numeric;
  rate integer := (p_settings->>'rate_per_hour')::integer;
BEGIN
  IF NOT public.is_studio_admin() THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  IF opening IS NULL OR closing IS NULL OR opening >= closing
    OR extract(minute FROM opening) <> 0 OR extract(second FROM opening) <> 0
    OR extract(minute FROM closing) <> 0 OR extract(second FROM closing) <> 0
    OR hold_minutes IS NULL OR hold_minutes <= 0 OR deposit IS NULL OR deposit <= 0 OR deposit > 1
    OR rate IS NULL OR rate <= 0 OR jsonb_typeof(p_settings->'reminder_enabled') IS DISTINCT FROM 'boolean'
  THEN RAISE EXCEPTION 'Invalid settings'; END IF;

  SELECT id INTO STRICT settings_id FROM public.settings FOR UPDATE;
  UPDATE public.settings SET operating_open = opening, operating_close = closing,
    hold_window_minutes = hold_minutes, default_deposit_pct = deposit,
    reminder_enabled = (p_settings->>'reminder_enabled')::boolean,
    gcash_qr_url = nullif(btrim(p_settings->>'gcash_qr_url'), ''),
    bank_name = nullif(btrim(p_settings->>'bank_name'), ''),
    account_name = nullif(btrim(p_settings->>'account_name'), ''),
    account_number = nullif(btrim(p_settings->>'account_number'), ''),
    terms_and_conditions = coalesce(btrim(p_settings->>'terms_and_conditions'), '')
  WHERE id = settings_id;
  UPDATE public.service_types SET rate_per_hour = rate, deposit_pct = deposit WHERE name = 'Rehearsal';
  IF NOT FOUND THEN RAISE EXCEPTION 'Rehearsal service not found'; END IF;
END $$;

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
  v_studio_subtotal integer;
  v_discount integer;
  v_voucher_code text := nullif(trim(p_request->>'voucher_code'), '');
  v_voucher vouchers%ROWTYPE;
  v_status booking_status;
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
     OR p_request->>'service' NOT IN ('Rehearsal','Recording')
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

  IF (p_request->>'terms_accepted')::boolean IS NOT TRUE THEN
    RAISE EXCEPTION 'terms_not_accepted';
  END IF;

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
  v_studio_subtotal := v_hours * v_service.rate_per_hour;
  v_discount := 0;

  IF v_voucher_code IS NOT NULL THEN
    SELECT * INTO v_voucher FROM vouchers WHERE upper(code) = upper(v_voucher_code) FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'voucher_not_found'; END IF;
    IF v_voucher.max_redemptions IS NOT NULL AND v_voucher.redemptions_used + v_count > v_voucher.max_redemptions THEN
      RAISE EXCEPTION 'voucher_exhausted';
    END IF;
    v_discount := public.compute_voucher_discount(v_studio_subtotal, v_voucher.percent, v_voucher.max_discount_centavos);
  END IF;

  v_total := (v_studio_subtotal - v_discount) + v_equipment_total;
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
      v_code := public.generate_confirmation_code(p_request->>'service');
      BEGIN
        v_status := CASE WHEN v_total = 0 THEN 'confirmed' ELSE 'pending' END;
        INSERT INTO bookings(confirmation_code,customer_name,customer_email,customer_phone,band_name,start_at,end_at,service_type_id,status,source,hold_expires_at,total_amount,deposit_amount,amount_paid,payment_method,series_id,voucher_discount_centavos,terms_accepted_text,terms_accepted_at)
          VALUES(v_code,trim(p_request->>'name'),trim(p_request->>'email'),trim(p_request->>'phone'),nullif(trim(coalesce(p_request->>'band','')),''),v_session_start,v_session_end,v_service.id,v_status,'online',
            CASE WHEN v_total = 0 THEN NULL ELSE v_hold END,
            v_total,v_deposit,0,
            CASE WHEN v_total = 0 THEN 'none'::payment_method_type ELSE (p_request->>'payment')::payment_method_type END,
            v_series,v_discount,v_settings.terms_and_conditions,now())
          RETURNING id INTO v_id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint <> 'bookings_confirmation_code_key' OR v_code_attempts >= 8 THEN RAISE; END IF;
        v_code_attempts := v_code_attempts + 1;
      END;
    END LOOP;

    IF v_voucher_code IS NOT NULL THEN
      PERFORM public.validate_and_reserve_voucher(v_voucher_code, v_service.id, v_day, v_studio_subtotal, v_equipment_total, p_request->>'email', v_id);
      UPDATE bookings SET voucher_id = v_voucher.id, voucher_code_snapshot = v_voucher.code WHERE id = v_id;
      IF v_status = 'confirmed' THEN PERFORM public.consume_voucher_redemption(v_id); END IF;
    END IF;

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
