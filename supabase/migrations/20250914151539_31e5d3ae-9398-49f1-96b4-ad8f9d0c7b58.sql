-- Update the shared_calendar_settings to use proper JSON object format
UPDATE shared_calendar_settings 
SET setting_value = jsonb_build_object(
  'calendar_id', replace(setting_value::text, '"', ''),
  'calendar_name', ''
)
WHERE setting_key = 'selected_calendar_id' AND setting_value IS NOT NULL;