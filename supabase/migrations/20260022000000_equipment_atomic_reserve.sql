-- Migration: atomic equipment reservation RPC.
--
-- Fixes a double-booking race: createBooking.ts previously checked equipment
-- availability (via getUnavailableEquipment, in-memory) and inserted
-- booking_equipment as two separate, non-transactional round trips. Two
-- concurrent requests for the last unit of some gear could both read
-- "1 available, 0 in use", both pass the check, and both insert — see
-- 20260020000000_equipment_quantity.sql's comment: booking_equipment has no
-- natural per-unit identity for a DB exclusion constraint the way
-- bookings_no_overlap has for room/time overlap.
--
-- reserve_equipment() makes the check-then-reserve step atomic per
-- equipment_id using a transaction-scoped advisory lock
-- (pg_advisory_xact_lock), keyed by equipment_id, held for the life of the
-- calling transaction (i.e. the whole RPC call). A second concurrent call
-- for the same equipment_id blocks until the first commits, so it always
-- counts the first call's just-inserted booking_equipment row before
-- deciding availability — no TOCTOU window.
--
-- Advisory lock chosen over `SELECT ... FOR UPDATE` on the equipment row so
-- the anon role (which only has SELECT on equipment via RLS) doesn't need
-- extra grants; SECURITY DEFINER lets this function bypass RLS entirely for
-- its own reads/writes while the caller only needs EXECUTE.
--
-- Caller contract: the booking row must already exist (booking_id is a real
-- FK) before calling this. If any item comes back in the result set, the
-- caller must compensate by deleting the booking — booking_equipment rows
-- already inserted for OTHER items in the same call cascade-delete via
-- booking_equipment.booking_id ON DELETE CASCADE.

CREATE OR REPLACE FUNCTION reserve_equipment(
  p_booking_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_items jsonb -- [{"equipment_id": "<uuid>", "price_at_booking": <int centavos>}, ...]
)
RETURNS TABLE(unavailable_id uuid, unavailable_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  eid uuid;
  eqty integer;
  ename text;
  overlap_count integer;
BEGIN
  -- Deterministic order (by equipment_id) across all callers, so two
  -- concurrent bookings requesting overlapping sets of equipment always
  -- acquire advisory locks in the same order and can't deadlock.
  FOR item IN
    SELECT value FROM jsonb_array_elements(p_items) AS value
    ORDER BY (value->>'equipment_id')::uuid
  LOOP
    eid := (item->>'equipment_id')::uuid;

    -- Held until this transaction (this RPC call) commits or rolls back.
    PERFORM pg_advisory_xact_lock(hashtextextended(eid::text, 0));

    SELECT quantity, name INTO eqty, ename FROM equipment WHERE id = eid;

    IF eqty IS NULL THEN
      -- Equipment no longer exists — skip silently, matching the existing
      -- "drop ids that are no longer active" behavior in createBooking.ts.
      CONTINUE;
    END IF;

    SELECT count(*) INTO overlap_count
    FROM booking_equipment be
    JOIN bookings b ON b.id = be.booking_id
    WHERE be.equipment_id = eid
      AND b.status <> 'cancelled'
      AND b.start_at < p_end_at
      AND b.end_at > p_start_at;

    IF overlap_count >= eqty THEN
      unavailable_id := eid;
      unavailable_name := ename;
      RETURN NEXT;
    ELSE
      INSERT INTO booking_equipment (booking_id, equipment_id, price_at_booking)
      VALUES (p_booking_id, eid, ((item->>'price_at_booking')::integer));
    END IF;
  END LOOP;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION reserve_equipment(uuid, timestamptz, timestamptz, jsonb) TO anon, authenticated;
