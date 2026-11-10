-- Voucher/discount-code feature: schema, pricing/validation functions,
-- admin CRUD RPC, cancellation-release trigger, and discount integration
-- into create_customer_reservations().

CREATE TABLE vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  percent smallint NOT NULL CHECK (percent BETWEEN 1 AND 100),
  enabled boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  expires_at timestamptz,
  max_redemptions integer CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  redemptions_used integer NOT NULL DEFAULT 0,
  eligible_service_ids uuid[],
  min_studio_subtotal_centavos integer CHECK (min_studio_subtotal_centavos IS NULL OR min_studio_subtotal_centavos >= 0),
  booking_date_start date,
  booking_date_end date,
  max_discount_centavos integer CHECK (max_discount_centavos IS NULL OR max_discount_centavos >= 0),
  per_customer_limit integer CHECK (per_customer_limit IS NULL OR per_customer_limit > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE voucher_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES vouchers(id),
  booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id),
  customer_email_normalized text NOT NULL,
  studio_subtotal_centavos integer NOT NULL,
  equipment_subtotal_centavos integer NOT NULL,
  percent_snapshot smallint NOT NULL,
  discount_centavos integer NOT NULL,
  state text NOT NULL CHECK (state IN ('reserved','consumed','released')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX voucher_redemptions_voucher_id_idx ON voucher_redemptions(voucher_id);

ALTER TABLE bookings ADD COLUMN voucher_id uuid REFERENCES vouchers(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN voucher_code_snapshot text;
ALTER TABLE bookings ADD COLUMN voucher_discount_centavos integer NOT NULL DEFAULT 0;

CREATE POLICY admin_vouchers ON vouchers FOR ALL TO authenticated USING (public.is_studio_admin()) WITH CHECK (public.is_studio_admin());
CREATE POLICY admin_voucher_redemptions ON voucher_redemptions FOR ALL TO authenticated USING (public.is_studio_admin()) WITH CHECK (public.is_studio_admin());
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vouchers, voucher_redemptions FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON vouchers, voucher_redemptions TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.compute_voucher_discount(p_subtotal integer, p_percent integer, p_max_discount integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN p_max_discount IS NULL
    THEN floor(p_subtotal * p_percent / 100.0)::integer
    ELSE LEAST(floor(p_subtotal * p_percent / 100.0)::integer, p_max_discount)
  END;
$$;

-- Locks and validates a voucher for one booking occurrence, raising a
-- distinct exception per failed rule, then reserves the redemption.
-- Returns the discount in centavos.
CREATE OR REPLACE FUNCTION public.validate_and_reserve_voucher(
  p_code text, p_service_id uuid, p_session_date date,
  p_studio_subtotal integer, p_equipment_subtotal integer,
  p_email text, p_booking_id uuid
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_voucher vouchers%ROWTYPE;
  v_email text := lower(trim(p_email));
  v_customer_uses integer;
  v_discount integer;
BEGIN
  SELECT * INTO v_voucher FROM vouchers WHERE upper(code) = upper(trim(p_code)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'voucher_not_found'; END IF;
  IF NOT v_voucher.enabled THEN RAISE EXCEPTION 'voucher_disabled'; END IF;
  IF v_voucher.starts_at IS NOT NULL AND now() < v_voucher.starts_at THEN RAISE EXCEPTION 'voucher_not_yet_valid'; END IF;
  IF v_voucher.expires_at IS NOT NULL AND now() > v_voucher.expires_at THEN RAISE EXCEPTION 'voucher_expired'; END IF;
  IF v_voucher.eligible_service_ids IS NOT NULL AND p_service_id <> ALL(v_voucher.eligible_service_ids) THEN
    RAISE EXCEPTION 'voucher_service_ineligible';
  END IF;
  IF (v_voucher.booking_date_start IS NOT NULL AND p_session_date < v_voucher.booking_date_start)
    OR (v_voucher.booking_date_end IS NOT NULL AND p_session_date > v_voucher.booking_date_end) THEN
    RAISE EXCEPTION 'voucher_date_out_of_range';
  END IF;
  IF v_voucher.min_studio_subtotal_centavos IS NOT NULL AND p_studio_subtotal < v_voucher.min_studio_subtotal_centavos THEN
    RAISE EXCEPTION 'voucher_min_spend_not_met';
  END IF;
  IF v_voucher.max_redemptions IS NOT NULL AND v_voucher.redemptions_used >= v_voucher.max_redemptions THEN
    RAISE EXCEPTION 'voucher_exhausted';
  END IF;
  IF v_voucher.per_customer_limit IS NOT NULL THEN
    SELECT count(*) INTO v_customer_uses FROM voucher_redemptions
      WHERE voucher_id = v_voucher.id AND customer_email_normalized = v_email AND state IN ('reserved','consumed');
    IF v_customer_uses >= v_voucher.per_customer_limit THEN RAISE EXCEPTION 'voucher_customer_limit_reached'; END IF;
  END IF;

  v_discount := public.compute_voucher_discount(p_studio_subtotal, v_voucher.percent, v_voucher.max_discount_centavos);
  UPDATE vouchers SET redemptions_used = redemptions_used + 1, updated_at = now() WHERE id = v_voucher.id;
  INSERT INTO voucher_redemptions(voucher_id, booking_id, customer_email_normalized, studio_subtotal_centavos, equipment_subtotal_centavos, percent_snapshot, discount_centavos, state)
    VALUES (v_voucher.id, p_booking_id, v_email, p_studio_subtotal, p_equipment_subtotal, v_voucher.percent, v_discount, 'reserved');
  RETURN v_discount;
END $$;
REVOKE ALL ON FUNCTION public.validate_and_reserve_voucher(text,uuid,date,integer,integer,text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_and_reserve_voucher(text,uuid,date,integer,integer,text,uuid) TO service_role;

-- Read-only mirror of the same checks for the public quote endpoint. Never reserves.
CREATE OR REPLACE FUNCTION public.preview_voucher_discount(
  p_code text, p_service_id uuid, p_session_date date,
  p_studio_subtotal integer, p_equipment_subtotal integer, p_email text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_voucher vouchers%ROWTYPE;
  v_email text := lower(trim(p_email));
  v_customer_uses integer;
BEGIN
  SELECT * INTO v_voucher FROM vouchers WHERE upper(code) = upper(trim(p_code));
  IF NOT FOUND THEN RETURN jsonb_build_object('valid', false, 'reason', 'voucher_not_found'); END IF;
  IF NOT v_voucher.enabled THEN RETURN jsonb_build_object('valid', false, 'reason', 'voucher_disabled'); END IF;
  IF v_voucher.starts_at IS NOT NULL AND now() < v_voucher.starts_at THEN RETURN jsonb_build_object('valid', false, 'reason', 'voucher_not_yet_valid'); END IF;
  IF v_voucher.expires_at IS NOT NULL AND now() > v_voucher.expires_at THEN RETURN jsonb_build_object('valid', false, 'reason', 'voucher_expired'); END IF;
  IF v_voucher.eligible_service_ids IS NOT NULL AND p_service_id <> ALL(v_voucher.eligible_service_ids) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'voucher_service_ineligible');
  END IF;
  IF (v_voucher.booking_date_start IS NOT NULL AND p_session_date < v_voucher.booking_date_start)
    OR (v_voucher.booking_date_end IS NOT NULL AND p_session_date > v_voucher.booking_date_end) THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'voucher_date_out_of_range');
  END IF;
  IF v_voucher.min_studio_subtotal_centavos IS NOT NULL AND p_studio_subtotal < v_voucher.min_studio_subtotal_centavos THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'voucher_min_spend_not_met');
  END IF;
  IF v_voucher.max_redemptions IS NOT NULL AND v_voucher.redemptions_used >= v_voucher.max_redemptions THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'voucher_exhausted');
  END IF;
  IF v_voucher.per_customer_limit IS NOT NULL THEN
    SELECT count(*) INTO v_customer_uses FROM voucher_redemptions
      WHERE voucher_id = v_voucher.id AND customer_email_normalized = v_email AND state IN ('reserved','consumed');
    IF v_customer_uses >= v_voucher.per_customer_limit THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'voucher_customer_limit_reached');
    END IF;
  END IF;
  RETURN jsonb_build_object('valid', true, 'discount', public.compute_voucher_discount(p_studio_subtotal, v_voucher.percent, v_voucher.max_discount_centavos));
END $$;
REVOKE ALL ON FUNCTION public.preview_voucher_discount(text,uuid,date,integer,integer,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preview_voucher_discount(text,uuid,date,integer,integer,text) TO service_role;

-- Idempotent by construction: a second call finds no 'reserved' row and no-ops.
CREATE OR REPLACE FUNCTION public.release_voucher_redemption(p_booking_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_redemption_id uuid; v_voucher_id uuid;
BEGIN
  SELECT id, voucher_id INTO v_redemption_id, v_voucher_id FROM voucher_redemptions
    WHERE booking_id = p_booking_id AND state = 'reserved' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  UPDATE voucher_redemptions SET state = 'released', updated_at = now() WHERE id = v_redemption_id;
  UPDATE vouchers SET redemptions_used = greatest(redemptions_used - 1, 0), updated_at = now() WHERE id = v_voucher_id;
END $$;
REVOKE ALL ON FUNCTION public.release_voucher_redemption(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_voucher_redemption(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.consume_voucher_redemption(p_booking_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE voucher_redemptions SET state = 'consumed', updated_at = now()
    WHERE booking_id = p_booking_id AND state = 'reserved';
$$;
REVOKE ALL ON FUNCTION public.consume_voucher_redemption(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_voucher_redemption(uuid) TO service_role;

-- Admin CRUD, mirrors update_studio_settings's SECURITY INVOKER + in-body admin check.
CREATE OR REPLACE FUNCTION public.upsert_voucher(p_voucher jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_id uuid := nullif(p_voucher->>'id','')::uuid;
  v_code text := upper(trim(p_voucher->>'code'));
  v_percent integer := (p_voucher->>'percent')::integer;
BEGIN
  IF NOT public.is_studio_admin() THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  IF v_code = '' OR v_percent IS NULL OR v_percent < 1 OR v_percent > 100 THEN RAISE EXCEPTION 'Invalid voucher'; END IF;

  IF v_id IS NULL THEN
    INSERT INTO vouchers(code, percent, enabled, starts_at, expires_at, max_redemptions,
      eligible_service_ids, min_studio_subtotal_centavos, booking_date_start, booking_date_end,
      max_discount_centavos, per_customer_limit)
    VALUES (v_code, v_percent, coalesce((p_voucher->>'enabled')::boolean, true),
      (p_voucher->>'starts_at')::timestamptz, (p_voucher->>'expires_at')::timestamptz,
      (p_voucher->>'max_redemptions')::integer,
      (SELECT array_agg(value::uuid) FROM jsonb_array_elements_text(p_voucher->'eligible_service_ids')),
      (p_voucher->>'min_studio_subtotal_centavos')::integer,
      (p_voucher->>'booking_date_start')::date, (p_voucher->>'booking_date_end')::date,
      (p_voucher->>'max_discount_centavos')::integer, (p_voucher->>'per_customer_limit')::integer)
    RETURNING id INTO v_id;
  ELSE
    PERFORM 1 FROM vouchers WHERE id = v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Voucher not found'; END IF;
    UPDATE vouchers SET code = v_code, percent = v_percent,
      enabled = coalesce((p_voucher->>'enabled')::boolean, enabled),
      starts_at = (p_voucher->>'starts_at')::timestamptz, expires_at = (p_voucher->>'expires_at')::timestamptz,
      max_redemptions = (p_voucher->>'max_redemptions')::integer,
      eligible_service_ids = (SELECT array_agg(value::uuid) FROM jsonb_array_elements_text(p_voucher->'eligible_service_ids')),
      min_studio_subtotal_centavos = (p_voucher->>'min_studio_subtotal_centavos')::integer,
      booking_date_start = (p_voucher->>'booking_date_start')::date, booking_date_end = (p_voucher->>'booking_date_end')::date,
      max_discount_centavos = (p_voucher->>'max_discount_centavos')::integer,
      per_customer_limit = (p_voucher->>'per_customer_limit')::integer,
      updated_at = now()
    WHERE id = v_id;
  END IF;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.upsert_voucher(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.upsert_voucher(jsonb) TO authenticated;

-- Cancellation/expiry release: catches admin cancelBooking, cancelSeries (loops
-- over cancelBooking), the customer cancel/reschedule routes, and the RPC's own
-- bulk hold-expiry cleanup — all of them do a plain status UPDATE this observes.
CREATE OR REPLACE FUNCTION public.release_voucher_on_booking_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'cancelled' THEN
    PERFORM public.release_voucher_redemption(NEW.id);
  ELSIF OLD.status = 'pending' AND NEW.status = 'confirmed' THEN
    PERFORM public.consume_voucher_redemption(NEW.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER release_voucher_on_booking_status_change
  AFTER UPDATE OF status ON bookings FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.release_voucher_on_booking_status_change();

-- Extend create_customer_reservations with optional voucher_code support.
-- Same jsonb signature; old callers omitting voucher_code are unaffected.
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
  v_status text;
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
  v_studio_subtotal := v_hours * v_service.rate_per_hour;
  v_discount := 0;

  IF v_voucher_code IS NOT NULL THEN
    -- Whole-series quota pre-check: lock now and verify enough quota remains
    -- for every occurrence before any booking is inserted. A later per-
    -- occurrence reservation failure still rolls back the whole transaction,
    -- so "create all occurrences or none" holds regardless.
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
      v_code := 'DMS-' || upper(replace(gen_random_uuid()::text,'-',''));
      BEGIN
        v_status := CASE WHEN v_total = 0 THEN 'confirmed' ELSE 'pending' END;
        INSERT INTO bookings(confirmation_code,customer_name,customer_email,customer_phone,band_name,start_at,end_at,service_type_id,status,source,hold_expires_at,total_amount,deposit_amount,amount_paid,payment_method,series_id,voucher_discount_centavos)
          VALUES(v_code,trim(p_request->>'name'),trim(p_request->>'email'),trim(p_request->>'phone'),nullif(trim(coalesce(p_request->>'band','')),''),v_session_start,v_session_end,v_service.id,v_status,'online',
            CASE WHEN v_total = 0 THEN NULL ELSE v_hold END,
            v_total,v_deposit,0,
            CASE WHEN v_total = 0 THEN 'none'::payment_method_type ELSE (p_request->>'payment')::payment_method_type END,
            v_series,v_discount)
          RETURNING id INTO v_id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint <> 'bookings_confirmation_code_key' OR v_code_attempts >= 4 THEN RAISE; END IF;
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
