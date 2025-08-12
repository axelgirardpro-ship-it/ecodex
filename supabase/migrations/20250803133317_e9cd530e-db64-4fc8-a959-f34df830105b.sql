-- Phase 1: Créer workspace_id et finaliser les migrations

-- 1. Ajouter workspace_id à user_roles si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'workspace_id') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'company_id') THEN
      -- Renommer company_id vers workspace_id
      ALTER TABLE user_roles RENAME COLUMN company_id TO workspace_id;
    ELSE
      -- Créer workspace_id
      ALTER TABLE user_roles ADD COLUMN workspace_id uuid;
    END IF;
  END IF;
END $$;

-- 2. Permettre NULL pour workspace_id (rôles globaux)
ALTER TABLE user_roles ALTER COLUMN workspace_id DROP NOT NULL;

-- 3. Renommer company_id vers workspace_id dans search_history
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'search_history' AND column_name = 'company_id') THEN
    ALTER TABLE search_history RENAME COLUMN company_id TO workspace_id;
  END IF;
END $$;

-- 4. Renommer la table company_invitations vers workspace_invitations
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_invitations') THEN
    ALTER TABLE company_invitations RENAME TO workspace_invitations;
    ALTER TABLE workspace_invitations RENAME COLUMN company_id TO workspace_id;
  END IF;
END $$;

-- 5. Migrer global_user_roles vers user_roles avec workspace_id NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'global_user_roles') THEN
    INSERT INTO user_roles (user_id, workspace_id, role, assigned_by, created_at, updated_at)
    SELECT user_id, NULL, role, assigned_by, created_at, updated_at 
    FROM global_user_roles
    ON CONFLICT DO NOTHING;
    
    DROP TABLE global_user_roles;
  END IF;
END $$;

-- 6. Mettre à jour les fonctions SQL
CREATE OR REPLACE FUNCTION public.has_workspace_access(workspace_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
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
 SET search_path TO ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE id = workspace_id AND owner_id = auth.uid()
  );
END;
$function$;

-- 7. Mettre à jour is_supra_admin
CREATE OR REPLACE FUNCTION public.is_supra_admin(user_uuid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_uuid AND role = 'supra_admin' AND workspace_id IS NULL
  );
$function$;

-- 8. Créer trigger pour auto-création des accès base de données
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_create_database_access ON emission_factors;

CREATE TRIGGER trigger_create_database_access
  AFTER INSERT ON emission_factors
  FOR EACH ROW
  EXECUTE FUNCTION create_database_access_for_new_source();

-- 9. Ajouter contrainte unique sur database_plan_access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'unique_database_plan_tier'
  ) THEN
    ALTER TABLE database_plan_access 
    ADD CONSTRAINT unique_database_plan_tier 
    UNIQUE (database_name, plan_tier);
  END IF;
END $$;