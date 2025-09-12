-- Clean up corrupted tokens for non-Fitbit services
UPDATE api_configurations 
SET access_token = NULL, refresh_token = NULL, expires_at = NULL 
WHERE user_id = 'b7318f45-ae52-49f4-9db5-1662096679dd' 
AND service_name IN ('google', 'alexa');