-- Fix: Rehearsal rate was double-converted to centavos.
--
-- 20260014000000_8_2_fix_amount_centavos.sql multiplied ALL service_types
-- rates by 100, but Rehearsal's rate_per_hour (seeded in
-- 20260001000000_1_1_extensions_service_types.sql) was already stored in
-- centavos (35000 = P350/hr). The *100 turned it into 3500000 (P35,000/hr)
-- -- a live 100x pricing bug. 20260016000000 already corrected this same
-- double-conversion for 'Regular Tracking' (Recording) but missed
-- 'Rehearsal'.
--
-- Existing `bookings` rows are unaffected -- total_amount/deposit_amount
-- are snapshotted at booking time, not recomputed from service_types.
UPDATE service_types
SET rate_per_hour = 35000
WHERE name = 'Rehearsal' AND rate_per_hour = 3500000;
