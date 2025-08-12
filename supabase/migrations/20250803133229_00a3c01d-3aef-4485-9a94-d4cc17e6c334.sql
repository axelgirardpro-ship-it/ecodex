-- Phase 1: Finalisation des migrations de schéma (corrigée pour workspace_id nullable)

-- 1. Modifier la contrainte workspace_id pour permettre NULL (pour les rôles globaux)
ALTER TABLE user_roles ALTER COLUMN workspace_id DROP NOT NULL;

-- 2. Renommer company_id vers workspace_id dans les tables qui ne l'ont pas encore
DO $$
BEGIN
  -- user_roles (déjà fait mais vérifions)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'company_id') THEN
    ALTER TABLE user_roles RENAME COLUMN company_id TO workspace_id;
  END IF;
  
  -- search_history  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'search_history' AND column_name = 'company_id') THEN
    ALTER TABLE search_history RENAME COLUMN company_id TO workspace_id;
  END IF;
END $$;

-- 3. Renommer la table company_invitations vers workspace_invitations
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_invitations') THEN
    ALTER TABLE company_invitations RENAME TO workspace_invitations;
    ALTER TABLE workspace_invitations RENAME COLUMN company_id TO workspace_id;
  END IF;
END $$;

-- 4. Migrer global_user_roles vers user_roles avec workspace_id NULL pour les rôles globaux
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'global_user_roles') THEN
    INSERT INTO user_roles (user_id, workspace_id, role, assigned_by, created_at, updated_at)
    SELECT user_id, NULL, role, assigned_by, created_at, updated_at 
    FROM global_user_roles
    ON CONFLICT DO NOTHING;
    
    -- Supprimer la table global_user_roles après migration
    DROP TABLE global_user_roles;
  END IF;
END $$;

-- 5. Mettre à jour les fonctions SQL pour utiliser workspace_id
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

-- 6. Mettre à jour les politiques RLS
DROP POLICY IF EXISTS "Users can view roles in their companies" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage user roles" ON user_roles;

CREATE POLICY "Users can view roles in their workspaces" 
ON user_roles FOR SELECT 
USING (
  user_id = auth.uid() OR 
  (workspace_id IS NOT NULL AND is_workspace_owner(workspace_id)) OR 
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.workspace_id = user_roles.workspace_id 
    AND ur.role = 'admin'
  )
);

CREATE POLICY "Admins can manage user roles" 
ON user_roles FOR ALL 
USING (
  (workspace_id IS NOT NULL AND is_workspace_owner(workspace_id)) OR 
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.workspace_id = user_roles.workspace_id 
    AND ur.role = 'admin'
  )
);

-- 7. Créer trigger pour auto-création des accès base de données
CREATE OR REPLACE FUNCTION public.create_database_access_for_new_source()
RETURNS TRIGGER AS $$
BEGIN
  -- Insérer une nouvelle règle d'accès pour chaque plan si elle n'existe pas déjà
  INSERT INTO public.database_plan_access (database_name, plan_tier, accessible, created_by)
  VALUES 
    (NEW.source, 'freemium', false, auth.uid()),
    (NEW.source, 'standard', true, auth.uid()),
    (NEW.source, 'premium', true, auth.uid())
  ON CONFLICT (database_name, plan_tier) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS trigger_create_database_access ON emission_factors;

CREATE TRIGGER trigger_create_database_access
  AFTER INSERT ON emission_factors
  FOR EACH ROW
  EXECUTE FUNCTION create_database_access_for_new_source();

-- 8. Ajouter contrainte unique sur database_plan_access
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

-- 9. Mettre à jour la fonction is_supra_admin pour utiliser user_roles
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