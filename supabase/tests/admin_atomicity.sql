-- Run against the intended project; all fixture writes are rolled back.
BEGIN;
SET LOCAL request.jwt.claims = '{"role":"authenticated","app_metadata":{"role":"admin"}}';
DO $$
DECLARE before_settings jsonb; request jsonb; connection public.google_tokens%ROWTYPE;
BEGIN
  SELECT to_jsonb(s) INTO before_settings FROM public.settings s;
  SELECT to_jsonb(s) || jsonb_build_object('rate_per_hour',t.rate_per_hour) INTO request
    FROM public.settings s CROSS JOIN public.service_types t WHERE t.name='Rehearsal';
  PERFORM public.update_studio_settings(request);
  UPDATE public.service_types SET name='TEST ONLY rollback service' WHERE name='Rehearsal';
  BEGIN
    PERFORM public.update_studio_settings(request || jsonb_build_object('default_deposit_pct',0.37));
    RAISE EXCEPTION 'expected missing-service failure' USING ERRCODE='P0002';
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    IF SQLERRM <> 'Rehearsal service not found' THEN RAISE; END IF;
  END;
  IF (SELECT to_jsonb(s) FROM public.settings s) IS DISTINCT FROM before_settings THEN
    RAISE EXCEPTION 'partial settings update survived';
  END IF;
  SELECT * INTO connection FROM public.google_tokens LIMIT 1;
  IF connection.id IS NOT NULL THEN
    PERFORM public.replace_google_connection(connection.encrypted_refresh_token,connection.google_email);
    IF (SELECT id FROM public.google_tokens) <> connection.id THEN RAISE EXCEPTION 'connection identity changed'; END IF;
    BEGIN
      PERFORM public.replace_google_connection('',connection.google_email);
      RAISE EXCEPTION 'expected invalid-token failure' USING ERRCODE='P0002';
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
      IF SQLERRM <> 'Invalid Google connection' THEN RAISE; END IF;
    END;
    IF (SELECT encrypted_refresh_token FROM public.google_tokens) <> connection.encrypted_refresh_token THEN
      RAISE EXCEPTION 'connection token changed';
    END IF;
  END IF;
END $$;
ROLLBACK;

BEGIN;
SET LOCAL request.jwt.claims = '{"role":"authenticated","app_metadata":{}}';
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.replace_google_connection('TEST ONLY','test@example.com');
    RAISE EXCEPTION 'authorization failed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.update_studio_settings('{}'::jsonb);
    RAISE EXCEPTION 'authorization failed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
