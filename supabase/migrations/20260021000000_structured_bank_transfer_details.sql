-- Structured bank/InstaPay transfer fields for the admin settings payment
-- section (bank_name, account_name, account_number), plus a public bucket
-- for the QR image upload (replaces free-text gcash_qr_url as a manual
-- link with an actual uploaded image, admin-only write, public read since
-- it's shown to customers on their booking ticket).

ALTER TABLE settings ADD COLUMN bank_name text;
ALTER TABLE settings ADD COLUMN account_name text;
ALTER TABLE settings ADD COLUMN account_number text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-qr', 'payment-qr', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY payment_qr_admin_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-qr');

CREATE POLICY payment_qr_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'payment-qr')
  WITH CHECK (bucket_id = 'payment-qr');
