-- Add units preference to profiles table
ALTER TABLE public.profiles 
ADD COLUMN units_preference TEXT DEFAULT 'imperial' CHECK (units_preference IN ('metric', 'imperial'));