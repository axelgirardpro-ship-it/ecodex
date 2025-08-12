-- Add supra admin role for user 5c4628da-d45c-42f2-84f4-c9066323cf91
-- First check if the role doesn't already exist to avoid duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = '5c4628da-d45c-42f2-84f4-c9066323cf91' 
    AND role = 'supra_admin' 
    AND workspace_id IS NULL
  ) THEN
    INSERT INTO public.user_roles (user_id, role, workspace_id, assigned_by)
    VALUES ('5c4628da-d45c-42f2-84f4-c9066323cf91', 'supra_admin', NULL, auth.uid());
  END IF;
END $$;