-- Create table for shared calendar settings
CREATE TABLE public.shared_calendar_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  managed_by UUID NOT NULL, -- References the user who can manage these settings
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shared_calendar_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Anyone can view shared calendar settings" 
ON public.shared_calendar_settings 
FOR SELECT 
USING (true);

CREATE POLICY "Only manager can update shared calendar settings" 
ON public.shared_calendar_settings 
FOR ALL 
USING (auth.uid() = managed_by) 
WITH CHECK (auth.uid() = managed_by);

-- Add trigger for updated_at
CREATE TRIGGER update_shared_calendar_settings_updated_at
BEFORE UPDATE ON public.shared_calendar_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default calendar settings managed by will@w-j-lander.uk
INSERT INTO public.shared_calendar_settings (setting_key, setting_value, managed_by) VALUES 
('selected_calendar_id', '"primary"', 'b7318f45-ae52-49f4-9db5-1662096679dd');

-- Create a view for easier access to the master user's Google configuration
CREATE OR REPLACE VIEW public.master_google_config AS
SELECT *
FROM public.api_configurations
WHERE user_id = 'b7318f45-ae52-49f4-9db5-1662096679dd'
AND service_name = 'google';