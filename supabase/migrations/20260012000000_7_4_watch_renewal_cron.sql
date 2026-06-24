-- Migration 7.4: pg_cron jobs for GCal pull sync and watch channel renewal
-- Part of Danes Music Studio booking app — Google Calendar sync (Phase 07)
-- Schedules two jobs: hourly pull sync polling fallback, and 6-day watch channel renewal.
--
-- PREREQUISITES (must exist before running this migration):
-- 1. app.next_url database setting must be configured (done in Phase 4 migration prereqs)
-- 2. app.cron_secret database setting must be configured (done in Phase 4 migration prereqs)
-- 3. /api/cron/gcal-pull route must be deployed (Plan 07-05)
-- 4. /api/cron/gcal-renew route must be deployed (Plan 07-06)
-- 5. GCAL_WEBHOOK_TOKEN and GOOGLE_REDIRECT_URI must be set in Vercel env vars

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'gcal-pull-sync'
  ) THEN
    PERFORM cron.schedule(
      'gcal-pull-sync',
      '0 * * * *',
      $cron$
        SELECT net.http_post(
          url := current_setting('app.next_url') || '/api/cron/gcal-pull',
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'gcal-renew-watch'
  ) THEN
    PERFORM cron.schedule(
      'gcal-renew-watch',
      '0 3 */6 * *',
      $cron$
        SELECT net.http_post(
          url := current_setting('app.next_url') || '/api/cron/gcal-renew',
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

-- Verify jobs are scheduled:
-- SELECT jobname, schedule, command FROM cron.job WHERE jobname IN ('gcal-pull-sync', 'gcal-renew-watch');
--
-- Check job run history (after first scheduled fire):
-- SELECT * FROM cron.job_run_details WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname IN ('gcal-pull-sync', 'gcal-renew-watch')) ORDER BY start_time DESC LIMIT 10;
--
-- Check pg_net HTTP call results:
-- SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;
--
-- Unschedule if needed:
-- SELECT cron.unschedule('gcal-pull-sync');
-- SELECT cron.unschedule('gcal-renew-watch');
--
-- Test manually (without pg_cron):
-- curl -X POST https://your-domain/api/cron/gcal-pull -H "x-cron-secret: <secret>" -H "Content-Type: application/json" -d '{}'
-- curl -X POST https://your-domain/api/cron/gcal-renew -H "x-cron-secret: <secret>" -H "Content-Type: application/json" -d '{}'
