-- Migration corrigée pour implémenter le plan de simplification des workspaces
-- 1. Migrer tous les supra admins vers le workspace Global Administration (gestion des conflits)

DO $$
DECLARE
    global_admin_workspace_id UUID;
    supra_admin_record RECORD;
    existing_role_count INTEGER;
BEGIN
    -- Trouver le workspace Global Administration
    SELECT id INTO global_admin_workspace_id 
    FROM workspaces 
    WHERE name = 'Global Administration' 
    LIMIT 1;
    
    IF global_admin_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Workspace "Global Administration" not found. Please create it first.';
    END IF;
    
    RAISE NOTICE 'Found Global Administration workspace: %', global_admin_workspace_id;
    
    -- Migrer tous les supra admins avec workspace_id = NULL vers Global Administration
    FOR supra_admin_record IN 
        SELECT user_id, assigned_by, created_at 
        FROM user_roles 
        WHERE role = 'supra_admin' AND workspace_id IS NULL
    LOOP
        RAISE NOTICE 'Processing supra admin: %', supra_admin_record.user_id;
        
        -- Vérifier s'il existe déjà un rôle supra_admin pour cet utilisateur dans Global Administration
        SELECT COUNT(*) INTO existing_role_count
        FROM user_roles 
        WHERE user_id = supra_admin_record.user_id 
        AND workspace_id = global_admin_workspace_id 
        AND role = 'supra_admin';
        
        IF existing_role_count > 0 THEN
            -- Il existe déjà un rôle supra_admin pour cet utilisateur dans Global Administration
            -- Supprimer l'ancien rôle avec workspace_id = NULL
            RAISE NOTICE 'User % already has supra_admin role in Global Administration, removing NULL workspace role', supra_admin_record.user_id;
            DELETE FROM user_roles 
            WHERE user_id = supra_admin_record.user_id 
            AND role = 'supra_admin' 
            AND workspace_id IS NULL;
        ELSE
            -- Mettre à jour le workspace_id pour le supra admin (de NULL vers Global Administration)
            RAISE NOTICE 'Migrating supra admin % from NULL to Global Administration', supra_admin_record.user_id;
            UPDATE user_roles 
            SET workspace_id = global_admin_workspace_id,
                updated_at = now()
            WHERE user_id = supra_admin_record.user_id 
            AND role = 'supra_admin' 
            AND workspace_id IS NULL;
        END IF;
        
        -- S'assurer que le supra admin a une entrée dans la table users pour Global Administration
        INSERT INTO public.users (
            user_id, 
            workspace_id, 
            email,
            plan_type,
            subscribed,
            assigned_by,
            created_at
        )
        SELECT 
            supra_admin_record.user_id,
            global_admin_workspace_id,
            COALESCE(au.email, 'unknown@example.com'),
            'premium',
            true,
            supra_admin_record.assigned_by,
            supra_admin_record.created_at
        FROM auth.users au 
        WHERE au.id = supra_admin_record.user_id
        ON CONFLICT (user_id, workspace_id) 
        DO UPDATE SET 
            plan_type = 'premium',
            subscribed = true,
            updated_at = now();
            
        -- Mettre à jour les quotas pour premium
        INSERT INTO public.search_quotas (
            user_id, 
            plan_type, 
            searches_limit, 
            exports_limit,
            searches_used,
            exports_used
        )
        VALUES (
            supra_admin_record.user_id,
            'premium',
            NULL,
            NULL,
            0,
            0
        )
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            plan_type = 'premium',
            searches_limit = NULL,
            exports_limit = NULL,
            updated_at = now();
    END LOOP;
    
    RAISE NOTICE 'Supra admin migration completed';
END $$;

-- 2. Mettre à jour la fonction is_supra_admin pour chercher dans Global Administration
CREATE OR REPLACE FUNCTION public.is_supra_admin(user_uuid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.workspaces w ON ur.workspace_id = w.id
    WHERE ur.user_id = user_uuid 
    AND ur.role = 'supra_admin' 
    AND w.name = 'Global Administration'
  );
$function$;

-- 3. Modifier handle_new_user pour empêcher les multi-workspaces (sauf supra admins)
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
  SELECT COUNT(*) INTO existing_user_count 
  FROM public.users 
  WHERE email = user_email;
  
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
  INSERT INTO public.user_roles (user_id, workspace_id, role, assigned_by)
  VALUES (NEW.id, workspace_id, 'admin', NEW.id);
  
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

COMMENT ON FUNCTION public.is_supra_admin IS 'Vérifie si un utilisateur est supra admin en cherchant dans le workspace Global Administration';
COMMENT ON FUNCTION public.handle_new_user IS 'Gère la création des nouveaux utilisateurs avec la règle: un email = un workspace (sauf supra admins)';