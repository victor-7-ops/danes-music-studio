-- Migration 3.4: pg_cron hold-expiry job
-- Part of Danes Music Studio booking app — payments layer (Phase 03)
-- Cancels expired pending online bookings every 5 minutes.

-- Must precede the first reference to cron.job for clean database resets.
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Supabase must have pg_cron available in shared_preload_libraries; this
-- migration creates its schema before the first reference to cron.job.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cancel-expired-pending-bookings'
  ) THEN
    PERFORM cron.schedule(
      'cancel-expired-pending-bookings',
      '*/5 * * * *',
      $cron$
        UPDATE bookings
        SET status = 'cancelled'
        WHERE status = 'pending'
          AND source = 'online'
          AND hold_expires_at < now();
      $cron$
    );
  END IF;
END $$;

-- Verify job is scheduled:
-- SELECT * FROM cron.job;
--
-- Verify job has run (check after 5 minutes):
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
--
-- Unschedule if needed:
-- SELECT cron.unschedule('cancel-expired-pending-bookings');
