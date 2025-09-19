-- Fix is_supra_admin signature to avoid overload ambiguity during restore/upgrade
-- 1) Remove potential 0-argument overload if present
DROP FUNCTION IF EXISTS public.is_supra_admin();

-- 2) Ensure the 1-argument version exists with DEFAULT, used transparently by calls like is_supra_admin()
CREATE OR REPLACE FUNCTION public.is_supra_admin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = user_uuid
      AND (ur.is_supra_admin = TRUE OR ur.role = 'supra_admin')
  );
$$;


