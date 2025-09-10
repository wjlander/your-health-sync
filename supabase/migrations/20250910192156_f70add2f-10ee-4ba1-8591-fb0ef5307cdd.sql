-- Add redirect_url column to api_configurations table
ALTER TABLE public.api_configurations 
ADD COLUMN redirect_url TEXT;