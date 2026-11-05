-- Configure studio_site_url and studio_cron_secret in Vault before enabling jobs.
-- The cron secret must match CRON_SECRET in the deployed application.
SELECT cron.alter_job(
  job_id := jobid,
  command := format($job$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'studio_site_url') || %L,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'studio_cron_secret')
      ),
      body := '{}'::jsonb
    );
  $job$, CASE jobname
    WHEN 'send-24h-reminders' THEN '/api/cron/reminder'
    WHEN 'gcal-pull-sync' THEN '/api/cron/gcal-pull'
    WHEN 'gcal-renew-watch' THEN '/api/cron/gcal-renew'
  END)
)
FROM cron.job
WHERE jobname IN ('send-24h-reminders', 'gcal-pull-sync', 'gcal-renew-watch');
