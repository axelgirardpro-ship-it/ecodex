-- Migration pour supprimer toutes les données de l'utilisateur guillaumears44@gmail.com

DO $$
DECLARE
  target_user_id UUID;
  target_email TEXT := 'guillaumears44@gmail.com';
BEGIN
  -- Récupérer l'UUID de l'utilisateur basé sur l'email
  SELECT id INTO target_user_id 
  FROM auth.users 
  WHERE email = target_email;
  
  -- Si l'utilisateur n'existe pas, arrêter
  IF target_user_id IS NULL THEN
    RAISE NOTICE 'Utilisateur avec email % non trouvé', target_email;
    RETURN;
  END IF;
  
  RAISE NOTICE 'Suppression des données pour utilisateur: % (UUID: %)', target_email, target_user_id;
  
  -- Supprimer les données dans l'ordre approprié pour éviter les contraintes de clé étrangère
  
  -- 1. Supprimer l'historique de recherche
  DELETE FROM public.search_history WHERE user_id = target_user_id;
  RAISE NOTICE 'Historique de recherche supprimé';
  
  -- 2. Supprimer les favoris
  DELETE FROM public.favorites WHERE user_id = target_user_id;
  RAISE NOTICE 'Favoris supprimés';
  
  -- 3. Supprimer les quotas de recherche
  DELETE FROM public.search_quotas WHERE user_id = target_user_id;
  RAISE NOTICE 'Quotas de recherche supprimés';
  
  -- 4. Supprimer les sessions utilisateur
  DELETE FROM public.user_sessions WHERE user_id = target_user_id;
  RAISE NOTICE 'Sessions utilisateur supprimées';
  
  -- 5. Supprimer les logs d'audit
  DELETE FROM public.audit_logs WHERE user_id = target_user_id;
  RAISE NOTICE 'Logs d''audit supprimés';
  
  -- 6. Supprimer les assignations de sources (si l'utilisateur était assigné)
  DELETE FROM public.fe_source_workspace_assignments WHERE assigned_by = target_user_id;
  RAISE NOTICE 'Assignations de sources supprimées';
  
  -- 7. Supprimer les invitations de workspace créées par cet utilisateur
  DELETE FROM public.workspace_invitations WHERE invited_by = target_user_id;
  RAISE NOTICE 'Invitations de workspace supprimées';
  
  -- 8. Supprimer les rôles utilisateur
  DELETE FROM public.user_roles WHERE user_id = target_user_id OR assigned_by = target_user_id;
  RAISE NOTICE 'Rôles utilisateur supprimés';
  
  -- 9. Supprimer les datasets créés par cet utilisateur
  DELETE FROM public.datasets WHERE user_id = target_user_id OR uploaded_by = target_user_id;
  RAISE NOTICE 'Datasets supprimés';
  
  -- 10. Supprimer les imports de données
  DELETE FROM public.data_imports WHERE imported_by = target_user_id;
  RAISE NOTICE 'Imports de données supprimés';
  
  -- 11. Supprimer de la table users
  DELETE FROM public.users WHERE user_id = target_user_id;
  RAISE NOTICE 'Données utilisateur publiques supprimées';
  
  -- 12. Supprimer les workspaces appartenant à cet utilisateur
  -- (ceci supprimera automatiquement les données liées grâce aux contraintes CASCADE)
  DELETE FROM public.workspaces WHERE owner_id = target_user_id;
  RAISE NOTICE 'Workspaces supprimés';
  
  -- 13. Finalement, supprimer l'utilisateur de auth.users
  -- Ceci doit être fait en dernier car d'autres tables peuvent avoir des références
  DELETE FROM auth.users WHERE id = target_user_id;
  RAISE NOTICE 'Utilisateur supprimé de auth.users';
  
  RAISE NOTICE 'Suppression complète terminée pour l''utilisateur %', target_email;
  
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Erreur lors de la suppression: %', SQLERRM;
    RAISE;
END
$$;