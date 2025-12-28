-- Drop the old SELECT policy
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Create a new SELECT policy that allows:
-- 1. Users to view their own profile
-- 2. Staff members to view their owner's profile
CREATE POLICY "Users can view profiles" 
ON public.profiles 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR 
  user_id = get_staff_owner_id(auth.uid())
);