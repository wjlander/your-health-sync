-- Set up cron job to process scheduled notifications every minute
-- This requires pg_cron extension to be enabled
SELECT cron.schedule(
  'process-scheduled-notifications',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
        url:='https://mgpzuralipywzhmczqhf.supabase.co/functions/v1/process-scheduled-notifications',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ncHp1cmFsaXB5d3pobWN6cWhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MjE1NTcsImV4cCI6MjA3MzA5NzU1N30.iZXoTKwXv5uJYfEIhnI0ngTi3k2u25I-pQYJwWF_rpg"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);