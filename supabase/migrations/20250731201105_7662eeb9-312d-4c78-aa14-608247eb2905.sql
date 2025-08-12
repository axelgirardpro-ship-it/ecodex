-- Fix infinite recursion in global_user_roles policy by removing the recursive policy
DROP POLICY IF EXISTS "Supra admins can manage global roles" ON public.global_user_roles;

-- Create a simpler policy that avoids recursion
CREATE POLICY "Only service role can manage global roles" 
ON public.global_user_roles 
FOR ALL 
USING (current_setting('role') = 'service_role');