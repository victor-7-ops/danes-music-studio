-- Migration 8.2: Fix monetary columns — convert from pesos (numeric) to centavos (integer).
-- rate_per_hour, total_amount, deposit_amount, amount_paid were seeded/written as pesos.
-- All application code treats them as integer centavos. Multiply by 100 to realign.

-- service_types: rate_per_hour pesos → centavos, change to integer
UPDATE service_types SET rate_per_hour = rate_per_hour * 100;
ALTER TABLE service_types ALTER COLUMN rate_per_hour TYPE integer USING rate_per_hour::integer;

-- bookings: multiply all money columns by 100, change to integer
UPDATE bookings SET
  total_amount   = total_amount   * 100,
  deposit_amount = deposit_amount * 100,
  amount_paid    = amount_paid    * 100;

ALTER TABLE bookings ALTER COLUMN total_amount   TYPE integer USING total_amount::integer;
ALTER TABLE bookings ALTER COLUMN deposit_amount TYPE integer USING deposit_amount::integer;
ALTER TABLE bookings ALTER COLUMN amount_paid    TYPE integer USING amount_paid::integer;
