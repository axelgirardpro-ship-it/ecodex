-- Correction des limites d'exports selon les plans
-- Freemium et Standard : 0 exports
-- Premium : 1000 exports par mois

-- Mettre à jour tous les utilisateurs existants selon leur plan
UPDATE public.search_quotas 
SET exports_limit = CASE 
  WHEN plan_type = 'premium' THEN 1000
  WHEN plan_type = 'standard' THEN 0
  WHEN plan_type = 'freemium' THEN 0
  ELSE 0
END,
exports_used = CASE 
  WHEN plan_type IN ('standard', 'freemium') THEN 0
  ELSE exports_used
END;

-- Mettre à jour la fonction handle_new_user pour définir les bonnes limites lors de la création
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
  
  -- Extract user metadata ONLY from raw_user_meta_data
  company_name := COALESCE(
    NEW.raw_user_meta_data ->> 'company',
    NEW.raw_user_meta_data ->> 'organization',
    'My Workspace'
  );
  
  user_first_name := COALESCE(
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'given_name',
    split_part(NEW.raw_user_meta_data ->> 'name', ' ', 1),
    split_part(NEW.raw_user_meta_data ->> 'full_name', ' ', 1)
  );
  
  user_last_name := COALESCE(
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'family_name',
    NEW.raw_user_meta_data ->> 'surname',
    split_part(NEW.raw_user_meta_data ->> 'name', ' ', 2),
    split_part(NEW.raw_user_meta_data ->> 'full_name', ' ', 2)
  );
  
  -- Detect SSO provider from app_metadata or raw_user_meta_data
  provider_name := COALESCE(
    NEW.raw_app_meta_data ->> 'provider',
    NEW.raw_user_meta_data ->> 'provider',
    'email'
  );
  
  -- Create a new workspace for the user
  INSERT INTO public.workspaces (name, owner_id, plan_type)
  VALUES (company_name, NEW.id, 'freemium')
  RETURNING id INTO workspace_id;
  
  -- Insert into the new users table
  INSERT INTO public.users (
    user_id, 
    workspace_id, 
    first_name, 
    last_name, 
    company,
    email,
    plan_type,
    subscribed,
    assigned_by
  )
  VALUES (
    NEW.id,
    workspace_id,
    user_first_name,
    user_last_name,
    company_name,
    NEW.email,
    'freemium',
    false,
    NEW.id
  );
  
  -- Assign admin role to the new user (they created the workspace)
  INSERT INTO public.user_roles (user_id, workspace_id, role, assigned_by)
  VALUES (NEW.id, workspace_id, 'admin', NEW.id);
  
  -- Insert into search_quotas with correct limits according to plan
  -- Freemium: 10 searches, 0 exports
  INSERT INTO public.search_quotas (
    user_id, 
    plan_type, 
    searches_limit, 
    exports_limit
  )
  VALUES (
    NEW.id, 
    'freemium', 
    10, 
    0
  );
  
  -- Log the signup for audit purposes
  INSERT INTO public.audit_logs (user_id, action, details)
  VALUES (
    NEW.id,
    'user_signup',
    jsonb_build_object(
      'provider', provider_name,
      'domain', domain_name,
      'workspace_id', workspace_id,
      'email', user_email,
      'company', company_name,
      'first_name', user_first_name,
      'last_name', user_last_name
    )
  );
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log the error and re-raise
    INSERT INTO public.audit_logs (user_id, action, details)
    VALUES (
      NEW.id,
      'user_signup_error',
      jsonb_build_object(
        'error', SQLERRM,
        'error_detail', SQLSTATE,
        'email', NEW.email
      )
    );
    RAISE;
END;
$function$;