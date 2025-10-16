-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view own profile or admins can view all" ON public.profiles;

-- Create a new policy that allows everyone to view profiles
CREATE POLICY "Profiles are viewable by everyone"
ON public.profiles
FOR SELECT
USING (true);

-- Keep the existing insert policies
-- Users can still only insert/update their own profiles or admins can manage all