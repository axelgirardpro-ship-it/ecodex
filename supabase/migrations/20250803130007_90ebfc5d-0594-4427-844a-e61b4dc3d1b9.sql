-- Migration pour simplifier l'architecture de base de données (version corrigée)

-- 1. Ajouter workspace_id à la table profiles si elle n'existe pas déjà
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'workspace_id') THEN
        ALTER TABLE public.profiles ADD COLUMN workspace_id UUID;
    END IF;
END $$;

-- 2. Populer workspace_id dans profiles depuis user_roles
UPDATE public.profiles 
SET workspace_id = (
  SELECT ur.company_id 
  FROM public.user_roles ur 
  WHERE ur.user_id = profiles.user_id 
  LIMIT 1
)
WHERE workspace_id IS NULL;

-- 3. Rendre workspace_id obligatoire dans profiles
ALTER TABLE public.profiles 
ALTER COLUMN workspace_id SET NOT NULL;

-- 4. Ajouter une contrainte de clé étrangère si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_profiles_workspace') THEN
        ALTER TABLE public.profiles 
        ADD CONSTRAINT fk_profiles_workspace 
        FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5. Renommer company_id en workspace_id dans user_roles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'user_roles' AND column_name = 'company_id') THEN
        ALTER TABLE public.user_roles RENAME COLUMN company_id TO workspace_id;
    END IF;
END $$;

-- 6. Renommer company_id en workspace_id dans datasets si nécessaire
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'datasets' AND column_name = 'company_id') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'datasets' AND column_name = 'workspace_id') THEN
        ALTER TABLE public.datasets RENAME COLUMN company_id TO workspace_id;
    END IF;
END $$;

-- 7. Renommer company_id en workspace_id dans search_history
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'search_history' AND column_name = 'company_id') THEN
        ALTER TABLE public.search_history RENAME COLUMN company_id TO workspace_id;
    END IF;
END $$;

-- 8. Gérer les invitations
DO $$
BEGIN
    -- Renommer la table si elle n'a pas déjà été renommée
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_invitations') THEN
        -- Renommer la colonne d'abord
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_invitations' AND column_name = 'company_id') THEN
            ALTER TABLE public.company_invitations RENAME COLUMN company_id TO workspace_id;
        END IF;
        -- Puis renommer la table
        ALTER TABLE public.company_invitations RENAME TO workspace_invitations;
    END IF;
END $$;

-- 9. Migrer les données de global_user_roles vers user_roles si global_user_roles existe encore
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'global_user_roles') THEN
        -- Permettre workspace_id d'être NULL dans user_roles pour les rôles globaux
        ALTER TABLE public.user_roles ALTER COLUMN workspace_id DROP NOT NULL;
        
        -- Migrer les données
        INSERT INTO public.user_roles (user_id, workspace_id, role, assigned_by, created_at, updated_at)
        SELECT 
          user_id,
          NULL as workspace_id,
          role,
          assigned_by,
          created_at,
          updated_at
        FROM public.global_user_roles
        WHERE NOT EXISTS (
          SELECT 1 FROM public.user_roles ur 
          WHERE ur.user_id = global_user_roles.user_id 
          AND ur.role = global_user_roles.role 
          AND ur.workspace_id IS NULL
        );
        
        -- Supprimer la table global_user_roles
        DROP TABLE public.global_user_roles;
    ELSE
        -- Juste permettre workspace_id d'être NULL dans user_roles
        ALTER TABLE public.user_roles ALTER COLUMN workspace_id DROP NOT NULL;
    END IF;
END $$;

-- 10. Supprimer la table companies si elle existe encore
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
        DROP TABLE public.companies;
    END IF;
END $$;

-- 11. Créer ou remplacer les fonctions avec les nouveaux noms

-- Fonction has_workspace_access
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

-- Fonction is_workspace_owner
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

-- Fonction is_supra_admin mise à jour
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