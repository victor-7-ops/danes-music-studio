-- Migration 8.1: Seed Regular Tracking service type.
-- ON CONFLICT DO NOTHING makes re-running the migration safe.
INSERT INTO service_types (name, rate_per_hour, deposit_pct, active)
VALUES ('Regular Tracking', 1000.00, 0.500, true)
ON CONFLICT DO NOTHING;
