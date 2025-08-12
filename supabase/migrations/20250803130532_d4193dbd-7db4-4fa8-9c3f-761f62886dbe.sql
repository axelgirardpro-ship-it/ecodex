-- Migration finale étape par étape

-- 1. Renommer company_id en workspace_id dans toutes les tables
ALTER TABLE public.user_roles RENAME COLUMN company_id TO workspace_id;

-- 2. Renommer dans datasets si la colonne existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'datasets' AND column_name = 'company_id') THEN
        ALTER TABLE public.datasets RENAME COLUMN company_id TO workspace_id;
    END IF;
END $$;

-- 3. Renommer dans search_history si la colonne existe  
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'search_history' AND column_name = 'company_id') THEN
        ALTER TABLE public.search_history RENAME COLUMN company_id TO workspace_id;
    END IF;
END $$;

-- 4. Gérer les invitations
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_invitations') THEN
        ALTER TABLE public.company_invitations RENAME COLUMN company_id TO workspace_id;
        ALTER TABLE public.company_invitations RENAME TO workspace_invitations;
    END IF;
END $$;

-- 5. Permettre workspace_id d'être NULL pour les rôles globaux
ALTER TABLE public.user_roles ALTER COLUMN workspace_id DROP NOT NULL;

-- 6. Migrer global_user_roles vers user_roles si la table existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'global_user_roles') THEN
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
        
        DROP TABLE public.global_user_roles;
    END IF;
END $$;