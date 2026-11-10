-- create_admin_booking is SECURITY INVOKER (runs as the calling admin's own
-- JWT, matching update_studio_settings's pattern), so it needs its own
-- EXECUTE grant on every voucher function it calls directly - grants on
-- create_admin_booking itself don't cascade to functions it calls.
-- validate_and_reserve_voucher and consume_voucher_redemption were only
-- granted to service_role (correct for the SECURITY DEFINER customer RPC,
-- which runs as definer regardless of the caller's own grants), so admin
-- Advanced Booking/Walk-in with a voucher code failed with
-- "permission denied for function validate_and_reserve_voucher" - confirmed
-- live against production.
GRANT EXECUTE ON FUNCTION public.validate_and_reserve_voucher(text,uuid,date,integer,integer,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_voucher_redemption(uuid) TO authenticated;
