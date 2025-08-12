-- Migration finale: marquer les supra admins existants et simplifier la gestion
-- Approche: ajouter un flag is_supra_admin et marquer les utilisateurs appropriés

-- 1. Ajouter une colonne pour marquer les supra admins dans user_roles (si elle n'existe pas déjà)
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS is_supra_admin BOOLEAN DEFAULT FALSE;

-- 2. Marquer les supra admins existants avec workspace_id = NULL
UPDATE user_roles 
SET is_supra_admin = TRUE 
WHERE role = 'supra_admin' AND workspace_id IS NULL;

-- 3. Marquer aussi les utilisateurs qui ont un rôle admin dans Global Administration comme supra_admin
-- (car ils sont déjà dans le bon workspace)
UPDATE user_roles ur
SET is_supra_admin = TRUE
FROM workspaces w
WHERE ur.workspace_id = w.id 
AND w.name = 'Global Administration'
AND ur.role = 'admin'
AND ur.user_id IN (
    SELECT user_id FROM user_roles 
    WHERE role = 'supra_admin' AND workspace_id IS NULL
);

-- 4. Supprimer les anciens rôles supra_admin avec workspace_id = NULL maintenant qu'ils sont marqués
DELETE FROM user_roles 
WHERE role = 'supra_admin' AND workspace_id IS NULL;

-- 5. Mettre à jour la fonction is_supra_admin pour vérifier le flag is_supra_admin
CREATE OR REPLACE FUNCTION public.is_supra_admin(user_uuid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = user_uuid 
    AND ur.is_supra_admin = TRUE
  );
$function$;

-- 6. Modifier handle_new_user pour empêcher les multi-workspaces (sauf supra admins)
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
  existing_user_count INTEGER;
BEGIN
  -- Skip processing if this user is being created by a supra admin
  IF NEW.raw_user_meta_data ->> 'created_by_supra_admin' = 'true' THEN
    RETURN NEW;
  END IF;
  
  -- Extract email and user data
  user_email := NEW.email;
  domain_name := split_part(user_email, '@', 2);
  
  -- Vérifier si cet email existe déjà dans la table users (protection contre multi-workspace)
  -- Exclure les supra admins de cette vérification
  SELECT COUNT(*) INTO existing_user_count 
  FROM public.users u
  WHERE u.email = user_email
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = u.user_id AND ur.is_supra_admin = TRUE
  );
  
  IF existing_user_count > 0 THEN
    RAISE EXCEPTION 'Un compte existe déjà pour cet email: %. Un utilisateur ne peut avoir qu''un seul workspace.', user_email;
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
  INSERT INTO public.user_roles (user_id, workspace_id, role, assigned_by, is_supra_admin)
  VALUES (NEW.id, workspace_id, 'admin', NEW.id, FALSE);
  
  -- Insert into search_quotas with correct limits according to plan
  -- Use ON CONFLICT to avoid duplication
  INSERT INTO public.search_quotas (
    user_id, 
    plan_type, 
    searches_limit, 
    exports_limit,
    searches_used,
    exports_used
  )
  VALUES (
    NEW.id, 
    'freemium', 
    10, 
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
      'company', company_name,
      'first_name', user_first_name,
      'last_name', user_last_name,
      'one_workspace_per_email', true
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

COMMENT ON FUNCTION public.is_supra_admin IS 'Vérifie si un utilisateur est supra admin via le flag is_supra_admin dans user_roles';
COMMENT ON FUNCTION public.handle_new_user IS 'Gère la création des nouveaux utilisateurs avec la règle: un email = un workspace (sauf supra admins)';