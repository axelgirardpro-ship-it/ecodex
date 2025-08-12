-- Corriger les fonctions avec search_path manquant

-- Fonction normalize_email avec search_path approprié  
CREATE OR REPLACE FUNCTION public.normalize_email(email_input TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  local_part TEXT;
  domain_part TEXT;
  normalized_local TEXT;
BEGIN
  -- Séparer la partie locale du domaine
  local_part := split_part(email_input, '@', 1);
  domain_part := split_part(email_input, '@', 2);
  
  -- Enlever tout ce qui est après le "+" dans la partie locale
  normalized_local := split_part(local_part, '+', 1);
  
  -- Retourner l'email normalisé en minuscules
  RETURN lower(normalized_local || '@' || domain_part);
END;
$$;

-- Fonction handle_new_user avec search_path approprié
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  workspace_id UUID;
  user_email TEXT;
  normalized_user_email TEXT;
  domain_name TEXT;
  provider_name TEXT;
  company_name TEXT;
  user_first_name TEXT;
  user_last_name TEXT;
  existing_user_count INTEGER;
  existing_freemium_count INTEGER;
BEGIN
  -- Skip processing if this user is being created by a supra admin
  IF NEW.raw_user_meta_data ->> 'created_by_supra_admin' = 'true' THEN
    RETURN NEW;
  END IF;
  
  -- Extract email and user data
  user_email := NEW.email;
  normalized_user_email := public.normalize_email(user_email);
  domain_name := split_part(user_email, '@', 2);
  
  -- Vérifier si cet email existe déjà dans la table users (protection contre multi-workspace)
  -- Exclure les supra admins de cette vérification
  SELECT COUNT(*) INTO existing_user_count 
  FROM public.users u
  WHERE u.email = user_email
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = u.user_id AND ur.is_supra_admin = TRUE
  );
  
  IF existing_user_count > 0 THEN
    RAISE EXCEPTION 'Un compte existe déjà pour cet email: %. Un utilisateur ne peut avoir qu''un seul workspace.', user_email;
  END IF;
  
  -- Vérifier s'il existe déjà un compte freemium avec l'email normalisé
  SELECT COUNT(*) INTO existing_freemium_count
  FROM public.users u
  WHERE u.normalized_email = normalized_user_email
  AND u.plan_type = 'freemium'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = u.user_id AND ur.is_supra_admin = TRUE
  );
  
  IF existing_freemium_count > 0 THEN
    RAISE EXCEPTION 'Un compte freemium existe déjà pour cette adresse email normalisée: %. Tentative de contournement détectée.', normalized_user_email;
  END IF;
  
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
  
  -- Insert into the new users table with normalized email
  INSERT INTO public.users (
    user_id, 
    workspace_id, 
    first_name, 
    last_name, 
    company,
    email,
    normalized_email,
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
    normalized_user_email,
    'freemium',
    false,
    NEW.id
  );
  
  -- Assign admin role to the new user (they created the workspace)
  INSERT INTO public.user_roles (user_id, workspace_id, role, assigned_by, is_supra_admin)
  VALUES (NEW.id, workspace_id, 'admin', NEW.id, FALSE);
  
  -- Insert into search_quotas with correct limits according to plan
  -- Use ON CONFLICT to avoid duplication
  INSERT INTO public.search_quotas (
    user_id, 
    plan_type, 
    searches_limit, 
    exports_limit,
    clipboard_copies_limit,
    favorites_limit,
    searches_used,
    exports_used,
    clipboard_copies_used,
    favorites_used
  )
  VALUES (
    NEW.id, 
    'freemium', 
    NULL, -- Illimité pour freemium
    10,   -- 10 exports par mois
    10,   -- 10 copies par mois
    10,   -- 10 favoris max
    0,
    0,
    0,
    0
  )
  ON CONFLICT (user_id) DO NOTHING;
  
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
      'normalized_email', normalized_user_email,
      'company', company_name,
      'first_name', user_first_name,
      'last_name', user_last_name,
      'one_workspace_per_email', true,
      'freemium_duplicate_protection', true
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
        'email', NEW.email,
        'normalized_email', public.normalize_email(NEW.email)
      )
    );
    RAISE;
END;
$$;