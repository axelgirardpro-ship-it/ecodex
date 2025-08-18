-- Fix infinite recursion in user_roles policies
-- The problem is that policies reference user_roles table while checking permissions

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view roles in their workspaces" ON public.user_roles;

-- Create a security definer function to safely check user permissions
-- This avoids the recursion by bypassing RLS when checking permissions
CREATE OR REPLACE FUNCTION public.can_manage_user_roles(target_workspace_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
  user_role TEXT;
  is_workspace_owner BOOLEAN;
  is_supra BOOLEAN;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if supra admin (bypassing RLS)
  SELECT EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = current_user_id 
    AND workspace_id IS NULL 
    AND is_supra_admin = true
  ) INTO is_supra;
  
  IF is_supra THEN
    RETURN TRUE;
  END IF;
  
  -- Check if workspace owner (bypassing RLS)
  SELECT EXISTS(
    SELECT 1 FROM workspaces 
    WHERE id = target_workspace_id 
    AND owner_id = current_user_id
  ) INTO is_workspace_owner;
  
  IF is_workspace_owner THEN
    RETURN TRUE;
  END IF;
  
  -- Check if admin in this workspace (bypassing RLS)
  SELECT EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = current_user_id 
    AND workspace_id = target_workspace_id 
    AND role = 'admin'
  ) INTO user_role;
  
  RETURN COALESCE(user_role, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create a function to check if user can view user roles
CREATE OR REPLACE FUNCTION public.can_view_user_roles(target_workspace_id UUID, target_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- User can always view their own role
  IF current_user_id = target_user_id THEN
    RETURN TRUE;
  END IF;
  
  -- Use the management function for admin checks
  RETURN public.can_manage_user_roles(target_workspace_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create new policies using the security definer functions
CREATE POLICY "Users can manage user roles if authorized" 
ON public.user_roles 
FOR ALL 
USING (
  public.can_manage_user_roles(workspace_id)
);

CREATE POLICY "Users can view user roles if authorized" 
ON public.user_roles 
FOR SELECT 
USING (
  public.can_view_user_roles(workspace_id, user_id)
);

-- Also ensure the functions have proper permissions
GRANT EXECUTE ON FUNCTION public.can_manage_user_roles(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_user_roles(UUID, UUID) TO authenticated;
