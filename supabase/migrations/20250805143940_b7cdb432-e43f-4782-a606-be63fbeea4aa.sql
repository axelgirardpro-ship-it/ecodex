-- Create Global Administration workspace for supra admins
INSERT INTO public.workspaces (name, owner_id, plan_type)
SELECT 'Global Administration', id, 'premium'
FROM auth.users 
WHERE id IN (
  SELECT user_id FROM public.user_roles 
  WHERE role = 'supra_admin' AND workspace_id IS NULL
)
LIMIT 1
ON CONFLICT DO NOTHING;

-- Add original_role column to user_roles to track temporary changes
ALTER TABLE public.user_roles 
ADD COLUMN IF NOT EXISTS original_role text;

-- Update existing supra admins to have the original_role set
UPDATE public.user_roles 
SET original_role = 'supra_admin'
WHERE role = 'supra_admin' AND workspace_id IS NULL;

-- Assign supra admins to the Global Administration workspace
DO $$
DECLARE
  global_workspace_id uuid;
  supra_admin_record RECORD;
BEGIN
  -- Get the Global Administration workspace ID
  SELECT id INTO global_workspace_id 
  FROM public.workspaces 
  WHERE name = 'Global Administration' 
  LIMIT 1;
  
  -- If no Global Administration workspace exists, create one with a system user
  IF global_workspace_id IS NULL THEN
    -- Create with first user as owner, we'll update later
    INSERT INTO public.workspaces (name, plan_type)
    VALUES ('Global Administration', 'premium')
    RETURNING id INTO global_workspace_id;
  END IF;
  
  -- Update existing supra admin roles to have workspace_id
  FOR supra_admin_record IN 
    SELECT user_id FROM public.user_roles 
    WHERE role = 'supra_admin' AND workspace_id IS NULL
  LOOP
    -- Update the existing supra admin role to include workspace
    UPDATE public.user_roles 
    SET workspace_id = global_workspace_id
    WHERE user_id = supra_admin_record.user_id 
    AND role = 'supra_admin' 
    AND workspace_id IS NULL;
    
    -- Make sure workspace has an owner (set to first supra admin if no owner)
    UPDATE public.workspaces 
    SET owner_id = supra_admin_record.user_id
    WHERE id = global_workspace_id 
    AND owner_id IS NULL;
  END LOOP;
END $$;

-- Create function to check if user is originally a supra admin
CREATE OR REPLACE FUNCTION public.is_original_supra_admin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_uuid 
    AND (original_role = 'supra_admin' OR (role = 'supra_admin' AND original_role IS NULL))
  );
$function$;