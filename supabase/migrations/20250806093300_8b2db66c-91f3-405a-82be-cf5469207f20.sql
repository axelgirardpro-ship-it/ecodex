-- Supprimer les workspaces sans utilisateurs (version corrigée)

DO $$
DECLARE
    workspace_record RECORD;
    deleted_count INTEGER := 0;
    current_admin_user_id UUID;
BEGIN
    -- Récupérer un supra admin existant pour les logs
    SELECT user_id INTO current_admin_user_id
    FROM public.user_roles 
    WHERE is_supra_admin = true 
    LIMIT 1;
    
    -- Parcourir tous les workspaces sans utilisateurs
    FOR workspace_record IN 
        SELECT 
            w.id,
            w.name,
            w.plan_type,
            w.created_at,
            w.owner_id,
            au.email as owner_email,
            COUNT(u.user_id) as user_count
        FROM workspaces w
        LEFT JOIN users u ON u.workspace_id = w.id
        LEFT JOIN auth.users au ON au.id = w.owner_id
        GROUP BY w.id, w.name, w.plan_type, w.created_at, w.owner_id, au.email
        HAVING COUNT(u.user_id) = 0
    LOOP
        -- Log avant suppression pour audit (utiliser un supra admin existant)
        INSERT INTO public.audit_logs (user_id, action, details)
        VALUES (
            current_admin_user_id,
            'delete_empty_workspace',
            jsonb_build_object(
                'workspace_id', workspace_record.id,
                'workspace_name', workspace_record.name,
                'plan_type', workspace_record.plan_type,
                'created_at', workspace_record.created_at,
                'original_owner_id', workspace_record.owner_id,
                'owner_email', workspace_record.owner_email,
                'reason', 'Workspace had no users attached',
                'deletion_date', now(),
                'deleted_by_system', true
            )
        );
        
        -- Supprimer les données liées au workspace
        
        -- 1. Supprimer les invitations du workspace
        DELETE FROM public.workspace_invitations 
        WHERE workspace_id = workspace_record.id;
        
        -- 2. Supprimer les assignments de sources FE
        DELETE FROM public.fe_source_workspace_assignments 
        WHERE workspace_id = workspace_record.id;
        
        -- 3. Supprimer les facteurs d'émission du workspace
        DELETE FROM public.emission_factors 
        WHERE workspace_id = workspace_record.id;
        
        -- 4. Supprimer les datasets du workspace
        DELETE FROM public.datasets 
        WHERE workspace_id = workspace_record.id;
        
        -- 5. Enfin, supprimer le workspace
        DELETE FROM public.workspaces 
        WHERE id = workspace_record.id;
        
        deleted_count := deleted_count + 1;
        
        RAISE NOTICE 'Deleted empty workspace: % (ID: %)', workspace_record.name, workspace_record.id;
    END LOOP;
    
    -- Log de résumé
    INSERT INTO public.audit_logs (user_id, action, details)
    VALUES (
        current_admin_user_id,
        'cleanup_empty_workspaces_completed',
        jsonb_build_object(
            'deleted_workspaces_count', deleted_count,
            'cleanup_completed_at', now(),
            'operation_type', 'automated_cleanup'
        )
    );
    
    RAISE NOTICE 'Cleanup completed. Deleted % empty workspaces.', deleted_count;
    
END $$;

-- Vérification finale - Afficher les workspaces restants
SELECT 
    'Remaining Workspaces' as status,
    w.id,
    w.name,
    w.plan_type,
    COUNT(u.user_id) as user_count,
    STRING_AGG(DISTINCT au.email, ', ') as user_emails,
    w.created_at
FROM workspaces w
LEFT JOIN users u ON u.workspace_id = w.id
LEFT JOIN auth.users au ON au.id = u.user_id
GROUP BY w.id, w.name, w.plan_type, w.created_at
ORDER BY user_count DESC, w.created_at DESC;