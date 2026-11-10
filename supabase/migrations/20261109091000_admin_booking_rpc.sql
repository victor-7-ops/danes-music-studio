-- Atomic admin booking RPC: replaces createOnsite/createWalkIn direct
-- inserts with the same advisory-lock/FOR SHARE/equipment-quantity locking
-- as create_customer_reservations, and adds voucher support admin
-- Advanced Booking and Walk-in both need. SECURITY INVOKER + in-body
-- is_studio_admin() check (same pattern as update_studio_settings), since
-- real admin sessions call this directly, unlike the service-role-only
-- customer RPC.
CREATE OR REPLACE FUNCTION public.create_admin_booking(p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_mode text := p_request->>'mode';
  v_start time := (p_request->>'start')::time;
  v_end time := (p_request->>'end')::time;
  v_date date := (p_request->>'date')::date;
  v_service service_types%ROWTYPE;
  v_hours integer;
  v_studio_subtotal integer;
  v_equipment jsonb;
  v_item jsonb;
  v_price integer;
  v_qty integer;
  v_active_count integer;
  v_equipment_total integer;
  v_discount integer := 0;
  v_voucher_code text := nullif(trim(p_request->>'voucher_code'), '');
  v_voucher vouchers%ROWTYPE;
  v_total integer;
  v_deposit integer;
  v_payment_type text := p_request->>'payment_type';
  v_status text;
  v_payment_method text;
  v_amount_paid integer;
  v_session_start timestamptz;
  v_session_end timestamptz;
  v_code text;
  v_code_attempts integer := 0;
  v_constraint text;
  v_id uuid;
BEGIN
  IF NOT public.is_studio_admin() THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  IF v_mode NOT IN ('onsite','walk_in')
    OR v_date IS NULL OR v_start IS NULL OR v_end IS NULL OR v_start >= v_end
    OR date_part('minute', v_start) <> 0 OR date_part('minute', v_end) <> 0
    OR length(trim(coalesce(p_request->>'customer_name',''))) < 2
    OR (v_mode = 'onsite' AND length(trim(coalesce(p_request->>'customer_phone',''))) < 7)
    OR (v_mode = 'onsite' AND v_payment_type NOT IN ('unpaid','deposit','full'))
  THEN RAISE EXCEPTION 'invalid_booking_parameters' USING ERRCODE = '22023'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('studio-reservations-and-closures', 0));
  SELECT * INTO v_service FROM service_types WHERE name = coalesce(p_request->>'service', 'Rehearsal') AND active FOR SHARE;
  IF v_service.id IS NULL THEN RAISE EXCEPTION 'service_configuration_error'; END IF;

  v_equipment := coalesce(p_request->'equipment_ids', '[]'::jsonb);
  IF jsonb_typeof(v_equipment) <> 'array' OR jsonb_array_length(v_equipment) > 20 THEN RAISE EXCEPTION 'invalid_equipment'; END IF;
  IF (SELECT count(DISTINCT value::uuid) FROM jsonb_array_elements_text(v_equipment)) < jsonb_array_length(v_equipment) THEN
    RAISE EXCEPTION 'duplicate_equipment';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(v_equipment) ORDER BY value::text LOOP
    SELECT price_per_session INTO v_price FROM equipment WHERE id=(v_item #>> '{}')::uuid AND active FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'equipment_unavailable'; END IF;
  END LOOP;
  SELECT coalesce(sum(e.price_per_session),0) INTO v_equipment_total
    FROM equipment e JOIN (SELECT DISTINCT value::uuid AS id FROM jsonb_array_elements_text(v_equipment)) q ON q.id=e.id
    WHERE e.active;

  v_hours := extract(epoch FROM (v_end-v_start))/3600;
  v_studio_subtotal := v_hours * v_service.rate_per_hour;

  IF v_voucher_code IS NOT NULL THEN
    SELECT * INTO v_voucher FROM vouchers WHERE upper(code) = upper(v_voucher_code) FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'voucher_not_found'; END IF;
    IF v_voucher.max_redemptions IS NOT NULL AND v_voucher.redemptions_used >= v_voucher.max_redemptions THEN
      RAISE EXCEPTION 'voucher_exhausted';
    END IF;
    v_discount := public.compute_voucher_discount(v_studio_subtotal, v_voucher.percent, v_voucher.max_discount_centavos);
  END IF;

  v_total := (v_studio_subtotal - v_discount) + v_equipment_total;
  v_deposit := floor(v_total * v_service.deposit_pct)::integer;

  v_session_start := (v_date::text || ' ' || v_start::text)::timestamp AT TIME ZONE 'Asia/Manila';
  v_session_end := (v_date::text || ' ' || v_end::text)::timestamp AT TIME ZONE 'Asia/Manila';
  IF EXISTS (SELECT 1 FROM bookings b WHERE b.status IN ('pending','confirmed','completed')
    AND tstzrange(b.start_at,b.end_at,'[)') && tstzrange(v_session_start,v_session_end,'[)')) THEN
    RAISE EXCEPTION 'bookings_no_overlap';
  END IF;

  IF v_mode = 'walk_in' THEN
    v_status := 'completed'; v_payment_method := 'none'; v_amount_paid := v_total;
  ELSIF v_total = 0 THEN
    v_status := 'confirmed'; v_payment_method := 'none'; v_amount_paid := 0;
  ELSE
    v_status := CASE WHEN v_payment_type = 'unpaid' THEN 'pending' ELSE 'confirmed' END;
    v_payment_method := CASE WHEN v_payment_type = 'unpaid' THEN 'none' ELSE v_payment_type END;
    v_amount_paid := CASE v_payment_type WHEN 'full' THEN v_total WHEN 'deposit' THEN v_deposit ELSE 0 END;
  END IF;

  LOOP
    v_code := 'DMS-' || upper(replace(gen_random_uuid()::text,'-',''));
    BEGIN
      INSERT INTO bookings(confirmation_code,customer_name,customer_email,customer_phone,band_name,start_at,end_at,service_type_id,status,source,hold_expires_at,total_amount,deposit_amount,amount_paid,payment_method,voucher_discount_centavos)
        VALUES(v_code, trim(p_request->>'customer_name'), coalesce(trim(p_request->>'customer_email'),''), coalesce(trim(p_request->>'customer_phone'),''),
          nullif(trim(coalesce(p_request->>'band_name','')),''), v_session_start, v_session_end, v_service.id, v_status,
          CASE WHEN v_mode = 'walk_in' THEN 'walk_in' ELSE 'onsite' END, NULL, v_total, v_deposit, v_amount_paid, v_payment_method::payment_method_type, v_discount)
        RETURNING id INTO v_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF v_constraint <> 'bookings_confirmation_code_key' OR v_code_attempts >= 4 THEN RAISE; END IF;
      v_code_attempts := v_code_attempts + 1;
    END;
  END LOOP;

  IF v_voucher_code IS NOT NULL THEN
    PERFORM public.validate_and_reserve_voucher(v_voucher_code, v_service.id, v_date, v_studio_subtotal, v_equipment_total, coalesce(p_request->>'customer_email',''), v_id);
    UPDATE bookings SET voucher_id = v_voucher.id, voucher_code_snapshot = v_voucher.code WHERE id = v_id;
    IF v_status IN ('confirmed','completed') THEN PERFORM public.consume_voucher_redemption(v_id); END IF;
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

  RETURN jsonb_build_object('id', v_id, 'code', v_code, 'status', v_status);
END $$;
REVOKE ALL ON FUNCTION public.create_admin_booking(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_admin_booking(jsonb) TO authenticated;
