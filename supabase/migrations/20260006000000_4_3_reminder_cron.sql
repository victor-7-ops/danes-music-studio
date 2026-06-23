-- Migration 4.3: pg_cron 24h reminder job
-- Part of Danes Music Studio booking app — email layer (Phase 04)
-- Schedules hourly HTTP call to /api/cron/reminder via pg_net (D-08)
--
-- PREREQUISITES (manual steps before running this migration):
-- 1. Enable pg_net in Supabase Dashboard → Database → Extensions → pg_net
-- 2. Run in SQL editor: ALTER DATABASE postgres SET "app.cron_secret" = '<your-CRON_SECRET-value>';
-- 3. Run in SQL editor: ALTER DATABASE postgres SET "app.next_url" = 'https://your-production-domain.vercel.app';
-- These settings are read at cron fire time via current_setting().

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'send-24h-reminders'
  ) THEN
    PERFORM cron.schedule(
      'send-24h-reminders',
      '0 * * * *',
      $cron$
        SELECT net.http_post(
          url := current_setting('app.next_url') || '/api/cron/reminder',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', current_setting('app.cron_secret')
          ),
          body := '{}'::jsonb
        );
      $cron$
    );
  END IF;
END $$;

-- Verify job is scheduled:
-- SELECT * FROM cron.job WHERE jobname = 'send-24h-reminders';
--
-- Check job run history (after first hourly fire):
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
--
-- Check pg_net HTTP call results (after job fires):
-- SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;
--
-- Unschedule if needed:
-- SELECT cron.unschedule('send-24h-reminders');
--
-- Test the cron route manually (without pg_cron):
-- curl -X POST https://your-domain/api/cron/reminder -H "x-cron-secret: <secret>" -H "Content-Type: application/json" -d '{}'
