-- Migration pour simplifier l'architecture - Partie 2: Renommage et migration

-- 1. Renommer company_id en workspace_id dans user_roles
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'user_roles' AND column_name = 'company_id') THEN
        ALTER TABLE public.user_roles RENAME COLUMN company_id TO workspace_id;
    END IF;
END $$;

-- 2. Renommer company_id en workspace_id dans datasets si nécessaire
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'datasets' AND column_name = 'company_id') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'datasets' AND column_name = 'workspace_id') THEN
        ALTER TABLE public.datasets RENAME COLUMN company_id TO workspace_id;
    END IF;
END $$;

-- 3. Renommer company_id en workspace_id dans search_history
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

-- 5. Permettre workspace_id d'être NULL dans user_roles pour les rôles globaux
ALTER TABLE public.user_roles ALTER COLUMN workspace_id DROP NOT NULL;

-- 6. Migrer les données de global_user_roles vers user_roles si global_user_roles existe encore
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'global_user_roles') THEN
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
    END IF;
END $$;

-- 7. Supprimer la table companies si elle existe encore
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
        DROP TABLE public.companies;
    END IF;
END $$;