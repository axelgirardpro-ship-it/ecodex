-- Add UPDATE policy for database_plan_access table for supra admins
CREATE POLICY "Supra admins can update database access rules" 
ON public.database_plan_access 
FOR UPDATE 
USING (is_supra_admin());