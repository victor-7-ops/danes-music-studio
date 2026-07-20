-- Plan 022: server-side content-type validation for the payment-qr bucket.
--
-- The bucket was created in 20260021000000_structured_bank_transfer_details.sql
-- with no allowed_mime_types restriction, so Supabase Storage accepted any
-- file regardless of what the uploading client claimed as file.type. The
-- upload widget (src/components/admin/StudioSettingsForm.tsx) only checks
-- file.type.startsWith('image/') client-side, which is spoofable — this
-- migration adds the real, server-side enforcement layer that can't be
-- bypassed by a modified client request.
--
-- Admin-only surface (only an authenticated admin session can reach the
-- upload widget), so this is defense-in-depth hardening rather than a fix
-- for an actively exploited gap.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
WHERE id = 'payment-qr';
