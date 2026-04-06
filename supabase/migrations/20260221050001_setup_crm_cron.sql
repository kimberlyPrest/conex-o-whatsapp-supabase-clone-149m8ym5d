-- Enable pg_net to make HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Enable pg_cron for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove the job if it exists to allow safe reruns
SELECT cron.unschedule('crm-automation-cron')
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'crm-automation-cron'
);

-- Schedule the CRM automation Edge Function to run every minute
SELECT cron.schedule(
  'crm-automation-cron',
  '* * * * *',
  $$
  SELECT net.http_post(
      url := 'https://afogztprmxulyufzitgo.supabase.co/functions/v1/crm-automation',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
  );
  $$
);
