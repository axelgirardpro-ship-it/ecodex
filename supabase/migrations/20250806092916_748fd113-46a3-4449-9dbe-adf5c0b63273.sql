-- Promouvoir axelgirard.pro+dev@gmail.com en supra admin dans Global Administration

DO $$
DECLARE
    target_user_id UUID := 'e6e2e278-14e9-44fd-86ff-28da775f43c6';
    target_email TEXT := 'axelgirard.pro+dev@gmail.com';
    global_workspace_id UUID;
    old_workspace_id UUID;
    old_workspace_name TEXT;
BEGIN
    -- Récupérer l'ID du workspace Global Administration
    SELECT id INTO global_workspace_id 
    FROM public.workspaces 
    WHERE name = 'Global Administration';
    
    IF global_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Global Administration workspace not found';
    END IF;
    
    -- Récupérer l'ancien workspace pour audit
    SELECT u.workspace_id, w.name INTO old_workspace_id, old_workspace_name
    FROM public.users u
    LEFT JOIN public.workspaces w ON w.id = u.workspace_id
    WHERE u.user_id = target_user_id;
    
    -- Log de début d'opération
    INSERT INTO public.audit_logs (user_id, action, details)
    VALUES (
        target_user_id,
        'promote_to_supra_admin_start',
        jsonb_build_object(
            'email', target_email,
            'old_workspace_id', old_workspace_id,
            'old_workspace_name', old_workspace_name,
            'new_workspace_id', global_workspace_id,
            'new_workspace_name', 'Global Administration',
            'promotion_date', now()
        )
    );
    
    -- 1. Mettre à jour la table users pour changer le workspace
    UPDATE public.users 
    SET 
        workspace_id = global_workspace_id,
        plan_type = 'premium',
        subscribed = true,
        updated_at = now()
    WHERE user_id = target_user_id;
    
    -- 2. Supprimer l'ancien rôle dans l'ancien workspace
    DELETE FROM public.user_roles 
    WHERE user_id = target_user_id AND workspace_id = old_workspace_id;
    
    -- 3. Créer le nouveau rôle supra admin dans Global Administration
    INSERT INTO public.user_roles (
        user_id, 
        workspace_id, 
        role, 
        is_supra_admin, 
        assigned_by,
        created_at,
        updated_at
    ) VALUES (
        target_user_id,
        global_workspace_id,
        'admin',
        true,
        target_user_id, -- auto-assigné
        now(),
        now()
    );
    
    -- 4. Mettre à jour les quotas pour unlimited (supra admin premium)
    UPDATE public.search_quotas 
    SET 
        plan_type = 'premium',
        searches_limit = NULL, -- unlimited
        exports_limit = NULL,  -- unlimited
        updated_at = now()
    WHERE user_id = target_user_id;
    
    -- Log de fin d'opération
    INSERT INTO public.audit_logs (user_id, action, details)
    VALUES (
        target_user_id,
        'promote_to_supra_admin_completed',
        jsonb_build_object(
            'email', target_email,
            'old_workspace', old_workspace_name,
            'new_workspace', 'Global Administration',
            'new_role', 'admin',
            'is_supra_admin', true,
            'plan_type', 'premium',
            'promotion_completed_at', now()
        )
    );
    
    RAISE NOTICE 'Successfully promoted % to supra admin in Global Administration', target_email;
    
END $$;

-- Vérification du résultat
SELECT 
    'Verification' as check_type,
    au.email,
    u.workspace_id,
    w.name as workspace_name,
    ur.role,
    ur.is_supra_admin,
    u.plan_type,
    u.subscribed,
    sq.searches_limit,
    sq.exports_limit
FROM auth.users au
JOIN public.users u ON u.user_id = au.id
JOIN public.workspaces w ON w.id = u.workspace_id
JOIN public.user_roles ur ON ur.user_id = au.id AND ur.workspace_id = u.workspace_id
LEFT JOIN public.search_quotas sq ON sq.user_id = au.id
WHERE au.email = 'axelgirard.pro+dev@gmail.com';