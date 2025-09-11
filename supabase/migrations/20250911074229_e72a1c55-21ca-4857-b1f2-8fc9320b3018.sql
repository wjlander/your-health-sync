-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job to sync Fitbit data every 15 minutes
SELECT cron.schedule(
  'fitbit-sync-every-15-minutes',
  '*/15 * * * *', -- every 15 minutes
  $$
  SELECT
    net.http_post(
        url:='https://mgpzuralipywzhmczqhf.supabase.co/functions/v1/sync-fitbit-data',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ncHp1cmFsaXB5d3pobWN6cWhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MjE1NTcsImV4cCI6MjA3MzA5NzU1N30.iZXoTKwXv5uJYfEIhnI0ngTi3k2u25I-pQYJwWF_rpg"}'::jsonb
    ) as request_id;
  $$
);

-- Enhance routines table to support multiple daily reminders with duration
ALTER TABLE routines 
ADD COLUMN IF NOT EXISTS reminder_times TEXT[], -- Array of times like ['08:00', '12:00', '18:00']
ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT 7, -- How many days to run this routine
ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE; -- When the routine should start