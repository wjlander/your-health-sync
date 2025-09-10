-- Fix function search path security issues
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- Move extensions to a dedicated schema (if possible, otherwise keep in public)
-- Note: pg_cron and pg_net extensions typically need to be in public schema for proper functionality
-- This is a known limitation and generally acceptable for these specific extensions