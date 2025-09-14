-- Fix the security definer view issue by dropping and recreating without security definer
DROP VIEW IF EXISTS public.master_google_config;

-- Create a regular view instead (will use the caller's permissions)
CREATE OR REPLACE VIEW public.master_google_config AS
SELECT *
FROM public.api_configurations
WHERE user_id = 'b7318f45-ae52-49f4-9db5-1662096679dd'
AND service_name = 'google';