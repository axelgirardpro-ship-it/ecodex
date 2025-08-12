-- Add missing RLS policies for emission_factors table

-- Allow supra admins to update emission factors (including plan_tier)
CREATE POLICY "Supra admins can update emission factors" 
ON public.emission_factors 
FOR UPDATE 
USING (is_supra_admin())
WITH CHECK (is_supra_admin());

-- Allow supra admins to delete emission factors if needed
CREATE POLICY "Supra admins can delete emission factors" 
ON public.emission_factors 
FOR DELETE 
USING (is_supra_admin());