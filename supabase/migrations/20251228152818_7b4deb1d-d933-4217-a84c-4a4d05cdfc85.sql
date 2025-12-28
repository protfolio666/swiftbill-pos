-- Drop the problematic INSERT policy
DROP POLICY IF EXISTS "Owners can create staff" ON public.staff_members;

-- Create a new policy that allows:
-- 1. Users to create their OWN owner record (user_id = auth.uid() AND owner_id = auth.uid() AND role = 'owner')
-- 2. Existing owners to create staff for their restaurant
CREATE POLICY "Users can create own owner record or owners can create staff"
ON public.staff_members FOR INSERT
WITH CHECK (
  -- Allow user to create their own owner record
  (user_id = auth.uid() AND owner_id = auth.uid() AND role = 'owner')
  OR
  -- Allow existing owners to create staff
  (owner_id = auth.uid() AND public.is_owner(auth.uid()))
);

-- Also fix KOT settings INSERT policy to allow new owners
DROP POLICY IF EXISTS "Owner can create KOT settings" ON public.kot_settings;

CREATE POLICY "Owner can create KOT settings"
ON public.kot_settings FOR INSERT
WITH CHECK (owner_id = auth.uid());