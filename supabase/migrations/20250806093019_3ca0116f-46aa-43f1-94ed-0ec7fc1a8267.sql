-- Nettoyer les rôles multiples d'axelgirard.pro+dev@gmail.com
-- Il est déjà supra admin dans Global Administration, on supprime juste son rôle dans Eco Search

DO $$
DECLARE
    target_user_id UUID := 'e6e2e278-14e9-44fd-86ff-28da775f43c6';
    target_email TEXT := 'axelgirard.pro+dev@gmail.com';
    global_workspace_id UUID;
    eco_search_workspace_id UUID;
BEGIN
    -- Récupérer les IDs des workspaces
    SELECT id INTO global_workspace_id 
    FROM public.workspaces 
    WHERE name = 'Global Administration';
    
    SELECT id INTO eco_search_workspace_id 
    FROM public.workspaces 
    WHERE name = 'Eco Search';
    
    -- Log de début d'opération
    INSERT INTO public.audit_logs (user_id, action, details)
    VALUES (
        target_user_id,
        'cleanup_multiple_roles_start',
        jsonb_build_object(
            'email', target_email,
            'global_workspace_id', global_workspace_id,
            'eco_search_workspace_id', eco_search_workspace_id,
            'action', 'Remove role from Eco Search, keep only Global Administration',
            'cleanup_date', now()
        )
    );
    
    -- 1. Supprimer le rôle dans Eco Search (garder seulement Global Administration)
    DELETE FROM public.user_roles 
    WHERE user_id = target_user_id 
    AND workspace_id = eco_search_workspace_id;
    
    -- 2. Mettre à jour la table users pour pointer vers Global Administration
    UPDATE public.users 
    SET 
        workspace_id = global_workspace_id,
        plan_type = 'premium',
        subscribed = true,
        updated_at = now()
    WHERE user_id = target_user_id;
    
    -- 3. Mettre à jour les quotas pour unlimited (supra admin premium)
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
        'cleanup_multiple_roles_completed',
        jsonb_build_object(
            'email', target_email,
            'final_workspace', 'Global Administration',
            'role', 'admin',
            'is_supra_admin', true,
            'plan_type', 'premium',
            'quotas', 'unlimited',
            'cleanup_completed_at', now()
        )
    );
    
    RAISE NOTICE 'Successfully cleaned up roles for %. Now only supra admin in Global Administration', target_email;
    
END $$;

-- Vérification finale des deux utilisateurs supra admin
SELECT 
    'Final Status' as status,
    au.email,
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
WHERE au.email IN ('axelgirard.pro+dev@gmail.com', 'guillaumears44@gmail.com')
ORDER BY au.email;