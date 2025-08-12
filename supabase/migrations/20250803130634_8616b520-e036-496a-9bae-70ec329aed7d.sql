-- Migration finale simple - juste nettoyer ce qui reste

-- 1. Migrer global_user_roles vers user_roles si la table existe encore
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

-- 2. Gérer les invitations si la table company_invitations existe encore
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_invitations') THEN
        -- Renommer la colonne si elle existe
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_invitations' AND column_name = 'company_id') THEN
            ALTER TABLE public.company_invitations RENAME COLUMN company_id TO workspace_id;
        END IF;
        -- Renommer la table
        ALTER TABLE public.company_invitations RENAME TO workspace_invitations;
    END IF;
END $$;