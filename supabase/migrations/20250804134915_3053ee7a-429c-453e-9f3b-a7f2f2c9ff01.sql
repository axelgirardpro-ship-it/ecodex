-- Fix handle_new_user function to work with existing tables
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  workspace_id UUID;
  user_email TEXT;
  domain_name TEXT;
  provider_name TEXT;
  company_name TEXT;
  user_first_name TEXT;
  user_last_name TEXT;
BEGIN
  -- Skip processing if this user is being created by a supra admin
  IF NEW.raw_user_meta_data ->> 'created_by_supra_admin' = 'true' THEN
    RETURN NEW;
  END IF;
  
  -- Extract email and user data
  user_email := NEW.email;
  domain_name := split_part(user_email, '@', 2);
  
  -- Extract user metadata
  company_name := COALESCE(
    NEW.raw_user_meta_data ->> 'company',
    NEW.raw_user_meta_data ->> 'organization',
    'My Workspace'
  );
  
  user_first_name := COALESCE(
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'given_name',
    split_part(NEW.raw_user_meta_data ->> 'name', ' ', 1)
  );
  
  user_last_name := COALESCE(
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'family_name',
    NEW.raw_user_meta_data ->> 'surname',
    split_part(NEW.raw_user_meta_data ->> 'name', ' ', 2)
  );
  
  -- Detect SSO provider from app_metadata
  provider_name := COALESCE(
    NEW.app_metadata ->> 'provider',
    NEW.raw_user_meta_data ->> 'provider',
    'email'
  );
  
  -- Create a new workspace for the user
  INSERT INTO public.workspaces (name, owner_id, plan_type)
  VALUES (company_name, NEW.id, 'freemium')
  RETURNING id INTO workspace_id;
  
  -- Insert into profiles with workspace_id
  INSERT INTO public.profiles (user_id, workspace_id, first_name, last_name, company)
  VALUES (
    NEW.id,
    workspace_id,
    user_first_name,
    user_last_name,
    company_name
  );
  
  -- Assign admin role to the new user (they created the workspace)
  INSERT INTO public.user_roles (user_id, workspace_id, role, assigned_by)
  VALUES (NEW.id, workspace_id, 'admin', NEW.id);
  
  -- Insert into subscribers with freemium plan
  INSERT INTO public.subscribers (user_id, email, plan_type, trial_end)
  VALUES (
    NEW.id,
    NEW.email,
    'freemium',
    now() + interval '7 days'
  );
  
  -- Insert into search_quotas with freemium limits
  INSERT INTO public.search_quotas (user_id, plan_type)
  VALUES (NEW.id, 'freemium');
  
  -- Log the SSO signup for audit purposes
  INSERT INTO public.audit_logs (user_id, action, details)
  VALUES (
    NEW.id,
    'user_signup',
    jsonb_build_object(
      'provider', provider_name,
      'domain', domain_name,
      'workspace_id', workspace_id,
      'email', user_email,
      'company', company_name
    )
  );
  
  RETURN NEW;
END;
$function$;