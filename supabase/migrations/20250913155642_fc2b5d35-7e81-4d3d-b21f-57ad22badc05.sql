-- Clear incorrect weight data for Jayne (user_id: 595d5a28-e8dd-4da1-aeae-b6f2c5c478fd)
-- This data was incorrectly synced from Will's account
DELETE FROM health_data 
WHERE user_id = '595d5a28-e8dd-4da1-aeae-b6f2c5c478fd' 
AND data_type = 'weight';