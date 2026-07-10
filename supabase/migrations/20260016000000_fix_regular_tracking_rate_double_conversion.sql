-- Migration: Fix Regular Tracking rate double-converted to centavos.
-- 20260013 seeded rate_per_hour already in centavos (100000 = ₱1000/hr).
-- The later pesos->centavos conversion migration (commit dd9343e) multiplied
-- every service_types row by 100 assuming pesos, double-converting this one
-- to 10,000,000 (₱100,000/hr). Rehearsal was genuinely in pesos at that point
-- so its conversion was correct and is left untouched.

UPDATE service_types
SET rate_per_hour = 100000
WHERE name = 'Regular Tracking' AND rate_per_hour = 10000000;
