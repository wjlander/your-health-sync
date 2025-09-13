-- Create storage bucket for notification sounds
INSERT INTO storage.buckets (id, name, public) VALUES ('notification-sounds', 'notification-sounds', false);

-- Create policies for notification sound uploads
CREATE POLICY "Users can view their own notification sounds" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'notification-sounds' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own notification sounds" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'notification-sounds' AND auth.uid()::text = (storage.foldername(name))[1] AND (storage.extension(name)) IN ('wav', 'mp3', 'ogg', 'm4a'));

CREATE POLICY "Users can update their own notification sounds" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'notification-sounds' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own notification sounds" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'notification-sounds' AND auth.uid()::text = (storage.foldername(name))[1]);