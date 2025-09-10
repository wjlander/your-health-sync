-- Update Fitbit sync cron job to run every 15 minutes
SELECT cron.unschedule('fitbit-daily-sync');

SELECT cron.schedule(
  'fitbit-15min-sync',
  '*/15 * * * *', -- every 15 minutes
  $$
  select
    net.http_post(
        url:='https://mgpzuralipywzhmczqhf.supabase.co/functions/v1/sync-fitbit-data',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ncHp1cmFsaXB5d3pobWN6cWhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MjE1NTcsImV4cCI6MjA3MzA5NzU1N30.iZXoTKwXv5uJYfEIhnI0ngTi3k2u25I-pQYJwWF_rpg"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Create weight_goals table for tracking weight loss goals
CREATE TABLE public.weight_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  start_weight NUMERIC NOT NULL,
  target_weight NUMERIC NOT NULL,
  weekly_loss_target NUMERIC NOT NULL DEFAULT 1.0,
  daily_calorie_deficit INTEGER NOT NULL DEFAULT 500,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  target_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.weight_goals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage own weight goals" 
ON public.weight_goals 
FOR ALL 
USING (auth.uid() = user_id);

-- Create weight_progress table for daily tracking
CREATE TABLE public.weight_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  goal_id UUID NOT NULL REFERENCES public.weight_goals(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_weight NUMERIC,
  calories_consumed INTEGER,
  calories_burned INTEGER,
  calorie_deficit_achieved INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, goal_id, date)
);

-- Enable RLS
ALTER TABLE public.weight_progress ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage own weight progress" 
ON public.weight_progress 
FOR ALL 
USING (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_weight_goals_updated_at
BEFORE UPDATE ON public.weight_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_weight_progress_updated_at
BEFORE UPDATE ON public.weight_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_weight_goals_user_id ON public.weight_goals(user_id);
CREATE INDEX idx_weight_goals_active ON public.weight_goals(user_id, is_active);
CREATE INDEX idx_weight_progress_user_goal ON public.weight_progress(user_id, goal_id);
CREATE INDEX idx_weight_progress_date ON public.weight_progress(date);