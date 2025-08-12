-- Corriger les problèmes de sécurité détectés

-- 1. Corriger Function Search Path Mutable pour toutes les fonctions
CREATE OR REPLACE FUNCTION public.has_workspace_access(workspace_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND workspace_id = $1
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(workspace_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE id = workspace_id AND owner_id = auth.uid()
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_supra_admin(user_uuid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_uuid AND role = 'supra_admin' AND workspace_id IS NULL
  );
$function$;

CREATE OR REPLACE FUNCTION public.create_database_access_for_new_source()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.database_plan_access (database_name, plan_tier, accessible, created_by)
  VALUES 
    (NEW.source, 'freemium', false, auth.uid()),
    (NEW.source, 'standard', true, auth.uid()),
    (NEW.source, 'premium', true, auth.uid())
  ON CONFLICT (database_name, plan_tier) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Corriger toutes les autres fonctions existantes
CREATE OR REPLACE FUNCTION public.has_company_access(company_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND workspace_id = $1
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1);
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_company_owner(company_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE id = company_id AND owner_id = auth.uid()
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.user_sessions 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_session_limit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  session_count INTEGER;
BEGIN
  -- Count current active sessions for this user
  SELECT COUNT(*) INTO session_count
  FROM public.user_sessions
  WHERE user_id = NEW.user_id 
  AND expires_at > now();
  
  -- If more than 2 sessions, delete the oldest ones
  IF session_count >= 2 THEN
    DELETE FROM public.user_sessions
    WHERE user_id = NEW.user_id
    AND id IN (
      SELECT id FROM public.user_sessions
      WHERE user_id = NEW.user_id
      AND expires_at > now()
      ORDER BY last_activity ASC
      LIMIT (session_count - 1)
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

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