-- Fix infinite recursion in RLS policies by creating security definer functions

-- Create function to get current user role safely
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create function to check if user is company owner
CREATE OR REPLACE FUNCTION public.is_company_owner(company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.companies 
    WHERE id = company_id AND owner_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Create function to check if user has access to company
CREATE OR REPLACE FUNCTION public.has_company_access(company_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND company_id = $1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Drop and recreate policies to fix recursion

-- Fix companies policies
DROP POLICY IF EXISTS "Users can view their own companies" ON public.companies;
CREATE POLICY "Users can view their own companies" ON public.companies
FOR SELECT 
USING (
  owner_id = auth.uid() OR 
  public.has_company_access(id)
);

-- Fix user_roles policies  
DROP POLICY IF EXISTS "Users can view roles in their companies" ON public.user_roles;
CREATE POLICY "Users can view roles in their companies" ON public.user_roles
FOR SELECT
USING (
  user_id = auth.uid() OR 
  public.is_company_owner(company_id) OR
  public.get_current_user_role() = 'admin'
);

DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
CREATE POLICY "Admins can manage user roles" ON public.user_roles
FOR ALL
USING (
  public.is_company_owner(company_id) OR
  public.get_current_user_role() = 'admin'
);