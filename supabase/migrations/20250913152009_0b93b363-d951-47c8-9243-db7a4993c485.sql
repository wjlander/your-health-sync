-- Update profiles RLS policy to allow viewing all profiles for task assignment
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Create new policy to allow viewing all profiles (for task assignment)
CREATE POLICY "Users can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true);

-- Keep the existing insert and update policies as they are
-- Users can still only insert/update their own profile