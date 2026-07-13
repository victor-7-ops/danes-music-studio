-- Migration: add quantity (unit count) to equipment.
-- Studio owner confirmed current gear is single-unit, so DEFAULT 1 treats all
-- existing rows correctly. Generalizable to >1 for future multi-unit gear at
-- no extra cost now. Paired with an app-level overlap/capacity check in
-- createBooking.ts (booking_equipment has no natural per-unit identity to
-- constrain at the DB level the way bookings_no_overlap does for rooms).

ALTER TABLE equipment
  ADD COLUMN quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1);
