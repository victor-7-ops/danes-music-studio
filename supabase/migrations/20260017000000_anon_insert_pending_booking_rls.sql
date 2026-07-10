-- Migration: Allow anon (public booking flow) to INSERT bookings.
-- bookings had only anon SELECT + authenticated ALL policies — no INSERT policy
-- for anon at all, so every online booking attempt was blocked by RLS in
-- production (createBooking.ts runs under the publishable/anon key).
-- Scoped WITH CHECK prevents spoofing confirmed/paid/walk-in rows from the client.

CREATE POLICY anon_insert_pending_booking ON bookings
  FOR INSERT TO anon
  WITH CHECK (status = 'pending' AND source = 'online' AND amount_paid = 0);
