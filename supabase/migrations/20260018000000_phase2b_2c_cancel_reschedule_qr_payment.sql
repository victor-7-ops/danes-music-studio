-- Migration: Phase 2b (self-service cancel/reschedule) + 2c (manual QR payment proof).

-- 2b: customer-facing manage link + reschedule chain
ALTER TABLE bookings ADD COLUMN cancel_token uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE bookings ADD COLUMN reschedule_from uuid REFERENCES bookings(id);
CREATE UNIQUE INDEX bookings_cancel_token_idx ON bookings(cancel_token);

-- 2c: manual QR payment. Column holds a storage PATH (private bucket below),
-- not a public URL — resolved to a signed URL on read.
ALTER TABLE bookings ADD COLUMN payment_proof_url text;
ALTER TABLE settings ADD COLUMN gcash_qr_url text;
ALTER TABLE settings ADD COLUMN bank_details text;

-- Storage bucket for uploaded payment proof screenshots. PRIVATE — these can
-- contain GCash/bank account details, so only admin (authenticated) can read
-- them, via a short-lived signed URL generated in the admin drawer. Uploads
-- go through a service-role route (bypasses RLS, gated by a pending-status
-- + booking-code check), not a public INSERT policy.
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY payment_proofs_admin_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs');
