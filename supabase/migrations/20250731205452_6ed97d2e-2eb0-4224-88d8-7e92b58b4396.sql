-- Update handle_new_user function to support SSO providers and workspace assignment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  company_id UUID;
  user_email TEXT;
  domain_name TEXT;
  existing_domain_workspace UUID;
  provider_name TEXT;
BEGIN
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
  
  -- Check if there's an existing workspace for this domain
  SELECT workspace_id INTO existing_domain_workspace
  FROM public.sso_domains 
  WHERE domain = domain_name 
  AND sso_type = CASE 
    WHEN provider_name = 'azure' THEN 'microsoft'
    WHEN provider_name = 'google' THEN 'google' 
    WHEN provider_name = 'saml' THEN 'saml'
    ELSE NULL
  END
  LIMIT 1;
  
  IF existing_domain_workspace IS NOT NULL THEN
    -- User joins existing workspace for their domain
    company_id := existing_domain_workspace;
    
    -- Assign default role (lecteur) to the new user in existing workspace
    INSERT INTO public.user_roles (user_id, company_id, role, assigned_by)
    VALUES (NEW.id, company_id, 'lecteur', NEW.id);
  ELSE
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
    
    -- Assign admin role to the new user (they created the workspace)
    INSERT INTO public.user_roles (user_id, company_id, role, assigned_by)
    VALUES (NEW.id, company_id, 'admin', NEW.id);
    
    -- If this is an SSO signup, potentially add domain mapping for future users
    IF provider_name IN ('google', 'azure', 'saml') THEN
      INSERT INTO public.sso_domains (domain, workspace_id, sso_type, default_role)
      VALUES (
        domain_name,
        company_id,
        CASE 
          WHEN provider_name = 'azure' THEN 'microsoft'
          WHEN provider_name = 'google' THEN 'google'
          WHEN provider_name = 'saml' THEN 'saml'
        END,
        'lecteur'
      )
      ON CONFLICT (domain) DO NOTHING; -- Don't override existing domain mappings
    END IF;
  END IF;
  
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
$$;