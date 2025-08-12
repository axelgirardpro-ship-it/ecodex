-- Drop the problematic toggle function that can't work due to permissions
DROP FUNCTION IF EXISTS public.toggle_new_user_trigger(boolean);

-- Update handle_new_user function to skip processing for supra admin creations
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  company_id UUID;
  user_email TEXT;
  domain_name TEXT;
  existing_domain_workspace UUID;
  provider_name TEXT;
BEGIN
  -- Skip processing if this user is being created by a supra admin
  IF NEW.raw_user_meta_data ->> 'created_by_supra_admin' = 'true' THEN
    RETURN NEW;
  END IF;
  
  -- Extract email from the new user
  user_email := NEW.email;
  domain_name := split_part(user_email, '@', 2);
  
  -- Detect SSO provider from app_metadata
  provider_name := COALESCE(
    NEW.app_metadata ->> 'provider',
    NEW.raw_user_meta_data ->> 'provider',
    'email'
  );
  
  -- Insert into profiles with SSO metadata
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data ->> 'first_name',
      NEW.raw_user_meta_data ->> 'given_name',
      NEW.raw_user_meta_data ->> 'name'
    ),
    COALESCE(
      NEW.raw_user_meta_data ->> 'last_name', 
      NEW.raw_user_meta_data ->> 'family_name',
      NEW.raw_user_meta_data ->> 'surname'
    )
  );
  
  -- Create a new company/workspace for the user
  INSERT INTO public.companies (name, owner_id, plan_type)
  VALUES (
    COALESCE(
      NEW.raw_user_meta_data ->> 'company',
      NEW.raw_user_meta_data ->> 'organization',
      'My Company'
    ),
    NEW.id,
    'freemium'
  ) RETURNING id INTO company_id;
  
  -- Create corresponding workspace with same data
  INSERT INTO public.workspaces (id, name, owner_id, plan_type)
  VALUES (
    company_id, -- Use same ID for consistency
    COALESCE(
      NEW.raw_user_meta_data ->> 'company',
      NEW.raw_user_meta_data ->> 'organization',
      'My Workspace'
    ),
    NEW.id,
    'freemium'
  );
  
  -- Assign admin role to the new user (they created the workspace)
  INSERT INTO public.user_roles (user_id, workspace_id, role, assigned_by)
  VALUES (NEW.id, company_id, 'admin', NEW.id);
  
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
      'workspace_id', company_id,
      'email', user_email
    )
  );
  
  RETURN NEW;
END;
$function$;