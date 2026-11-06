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
    account_number = nullif(btrim(p_settings->>'account_number'), '')
  WHERE id = settings_id;
  UPDATE public.service_types SET rate_per_hour = rate, deposit_pct = deposit WHERE name = 'Rehearsal';
  IF NOT FOUND THEN RAISE EXCEPTION 'Rehearsal service not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.update_studio_settings(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_studio_settings(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.replace_google_connection(p_encrypted_token text, p_google_email text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE connection_id uuid;
BEGIN
  IF NOT public.is_studio_admin() THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  IF nullif(btrim(p_encrypted_token), '') IS NULL OR nullif(btrim(p_google_email), '') IS NULL THEN
    RAISE EXCEPTION 'Invalid Google connection';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('studio-google-connection', 0));
  SELECT id INTO connection_id FROM public.google_tokens ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF connection_id IS NULL THEN
    INSERT INTO public.google_tokens(encrypted_refresh_token, google_email, calendar_id)
    VALUES (p_encrypted_token, p_google_email, 'primary');
  ELSE
    UPDATE public.google_tokens SET encrypted_refresh_token = p_encrypted_token,
      google_email = p_google_email, calendar_id = 'primary', sync_token = NULL,
      watch_channel_id = NULL, watch_resource_id = NULL, watch_expires_at = NULL, updated_at = now()
    WHERE id = connection_id;
    DELETE FROM public.google_tokens WHERE id <> connection_id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.replace_google_connection(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_google_connection(text,text) TO authenticated;
