-- Nettoyage des comptes orphelins et vérification de la cohérence

-- 1. Supprimer les user_roles pour les comptes qui n'existent plus dans auth.users (au cas où)
DELETE FROM public.user_roles 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 2. Supprimer les entrées dans users pour les comptes qui n'existent plus dans auth.users (au cas où)
DELETE FROM public.users 
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 3. Identifier et supprimer les comptes orphelins dans auth.users 
-- (ceux qui n'ont pas d'entrée correspondante dans notre table users)
DO $$
DECLARE
    orphan_user_id UUID;
    orphan_email TEXT;
BEGIN
    -- Parcourir les comptes orphelins
    FOR orphan_user_id, orphan_email IN 
        SELECT au.id, au.email
        FROM auth.users au
        LEFT JOIN public.users u ON u.user_id = au.id
        WHERE u.user_id IS NULL
    LOOP
        -- Log pour audit
        INSERT INTO public.audit_logs (user_id, action, details)
        VALUES (
            orphan_user_id,
            'cleanup_orphan_auth_user',
            jsonb_build_object(
                'email', orphan_email,
                'reason', 'User exists in auth.users but not in users table',
                'cleanup_date', now()
            )
        );
        
        -- Supprimer le compte de auth.users en utilisant l'admin API
        -- Note: Ceci sera fait via une fonction car nous ne pouvons pas supprimer directement de auth.users
        RAISE NOTICE 'Orphan account found: % (%)', orphan_email, orphan_user_id;
    END LOOP;
END $$;

-- 4. Vérifier la cohérence des supra admins
-- S'assurer que tous les supra admins sont dans le workspace Global Administration
DO $$
DECLARE
    global_workspace_id UUID;
    supra_admin_record RECORD;
BEGIN
    -- Trouver le workspace Global Administration
    SELECT id INTO global_workspace_id 
    FROM public.workspaces 
    WHERE name = 'Global Administration';
    
    IF global_workspace_id IS NULL THEN
        RAISE NOTICE 'No Global Administration workspace found';
        RETURN;
    END IF;
    
    -- Vérifier les supra admins qui ne sont pas dans le bon workspace
    FOR supra_admin_record IN 
        SELECT ur.user_id, ur.workspace_id, ur.role, au.email, w.name as current_workspace
        FROM public.user_roles ur
        JOIN auth.users au ON au.id = ur.user_id
        LEFT JOIN public.workspaces w ON w.id = ur.workspace_id
        WHERE ur.is_supra_admin = true 
        AND ur.workspace_id != global_workspace_id
    LOOP
        RAISE NOTICE 'Supra admin % (%) is in wrong workspace: %', 
            supra_admin_record.email, 
            supra_admin_record.user_id, 
            supra_admin_record.current_workspace;
            
        -- Log pour audit
        INSERT INTO public.audit_logs (user_id, action, details)
        VALUES (
            supra_admin_record.user_id,
            'supra_admin_workspace_inconsistency',
            jsonb_build_object(
                'email', supra_admin_record.email,
                'current_workspace', supra_admin_record.current_workspace,
                'expected_workspace', 'Global Administration',
                'check_date', now()
            )
        );
    END LOOP;
END $$;

-- 5. Afficher un résumé de la situation actuelle
SELECT 
    'Summary' as type,
    (SELECT COUNT(*) FROM auth.users) as auth_users_count,
    (SELECT COUNT(*) FROM public.users) as users_table_count,
    (SELECT COUNT(*) FROM public.user_roles WHERE is_supra_admin = true) as supra_admin_count,
    (SELECT COUNT(*) FROM public.workspaces WHERE name = 'Global Administration') as global_workspace_count;