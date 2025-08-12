-- Nettoyage des données résiduelles et création d'environnement de test (version finale)

-- 1. NETTOYAGE DES DONNÉES RÉSIDUELLES pour axelgirard69@gmail.com
-- Supprimer toutes les traces de l'ancien compte a987ba76-4a59-4977-b5b4-7e1c48d77acf

DELETE FROM public.search_history WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.search_quotas WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.favorites WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.audit_logs WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.user_roles WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.users WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.workspaces WHERE owner_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';

-- 2. CRÉATION DE L'ENVIRONNEMENT DE TEST

DO $$
DECLARE
    workspace_premium_id UUID;
    workspace_freemium1_id UUID;
    workspace_standard1_id UUID;
    workspace_standard2_id UUID;
    workspace_freemium2_id UUID;
    workspace_standard3_id UUID;
    
    user_supra_admin_id UUID := 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1';
    user_admin_premium_id UUID := 'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2';
    user_lecteur_freemium_id UUID := 'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3';
    user_lecteur_standard_id UUID := 'e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4';
    user_gestionnaire_standard_id UUID := 'e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5';
    user_admin_freemium_id UUID := 'e6e6e6e6-e6e6-e6e6-e6e6-e6e6e6e6e6e6';
    user_admin_standard_id UUID := 'e7e7e7e7-e7e7-e7e7-e7e7-e7e7e7e7e7e7';
BEGIN
    -- Créer les workspaces
    INSERT INTO public.workspaces (name, owner_id, plan_type) VALUES
    ('Premium Workspace', user_admin_premium_id, 'premium') RETURNING id INTO workspace_premium_id;
    
    INSERT INTO public.workspaces (name, owner_id, plan_type) VALUES
    ('Freemium Workspace 1', user_lecteur_freemium_id, 'freemium') RETURNING id INTO workspace_freemium1_id;
    
    INSERT INTO public.workspaces (name, owner_id, plan_type) VALUES
    ('Standard Workspace 1', user_lecteur_standard_id, 'standard') RETURNING id INTO workspace_standard1_id;
    
    INSERT INTO public.workspaces (name, owner_id, plan_type) VALUES
    ('Standard Workspace 2', user_gestionnaire_standard_id, 'standard') RETURNING id INTO workspace_standard2_id;
    
    INSERT INTO public.workspaces (name, owner_id, plan_type) VALUES
    ('Freemium Workspace 2', user_admin_freemium_id, 'freemium') RETURNING id INTO workspace_freemium2_id;
    
    INSERT INTO public.workspaces (name, owner_id, plan_type) VALUES
    ('Standard Workspace 3', user_admin_standard_id, 'standard') RETURNING id INTO workspace_standard3_id;

    -- Créer les utilisateurs de test dans la table users (y compris le supra admin avec un workspace temporaire)
    INSERT INTO public.users (user_id, workspace_id, first_name, last_name, company, email, plan_type, subscribed) VALUES
    -- axelgirard.pro+dev@gmail.com - supra admin (dans le premier workspace créé pour les quotas)
    (user_supra_admin_id, workspace_premium_id, 'Axel', 'SupraAdmin', 'Global Admin', 'axelgirard.pro+dev@gmail.com', 'premium', true),
    -- axelgirard.pro@gmail.com - admin workspace premium
    (user_admin_premium_id, workspace_premium_id, 'Axel', 'Girard', 'Premium Company', 'axelgirard.pro@gmail.com', 'premium', true),
    -- axelgirard69@gmail.com - lecteur workspace freemium
    (user_lecteur_freemium_id, workspace_freemium1_id, 'Axel', 'Test1', 'Freemium Company 1', 'axelgirard69@gmail.com', 'freemium', false),
    -- axelgirard69+1@gmail.com - lecteur workspace standard  
    (user_lecteur_standard_id, workspace_standard1_id, 'Axel', 'Test2', 'Standard Company 1', 'axelgirard69+1@gmail.com', 'standard', false),
    -- axelgirard69+2@gmail.com - gestionnaire workspace standard
    (user_gestionnaire_standard_id, workspace_standard2_id, 'Axel', 'Test3', 'Standard Company 2', 'axelgirard69+2@gmail.com', 'standard', false),
    -- axelgirard69+3@gmail.com - admin workspace freemium
    (user_admin_freemium_id, workspace_freemium2_id, 'Axel', 'Test4', 'Freemium Company 2', 'axelgirard69+3@gmail.com', 'freemium', false),
    -- axelgirard69+4@gmail.com - admin workspace standard
    (user_admin_standard_id, workspace_standard3_id, 'Axel', 'Test5', 'Standard Company 3', 'axelgirard69+4@gmail.com', 'standard', false);

    -- Créer les rôles utilisateurs
    INSERT INTO public.user_roles (user_id, workspace_id, role, assigned_by) VALUES
    -- Supra admin global (pas de workspace spécifique)
    (user_supra_admin_id, NULL, 'supra_admin', user_supra_admin_id),
    -- Admin workspace premium
    (user_admin_premium_id, workspace_premium_id, 'admin', user_admin_premium_id),
    -- Lecteur workspace freemium  
    (user_lecteur_freemium_id, workspace_freemium1_id, 'lecteur', user_lecteur_freemium_id),
    -- Lecteur workspace standard
    (user_lecteur_standard_id, workspace_standard1_id, 'lecteur', user_lecteur_standard_id),
    -- Gestionnaire workspace standard
    (user_gestionnaire_standard_id, workspace_standard2_id, 'gestionnaire', user_gestionnaire_standard_id),
    -- Admin workspace freemium
    (user_admin_freemium_id, workspace_freemium2_id, 'admin', user_admin_freemium_id),
    -- Admin workspace standard
    (user_admin_standard_id, workspace_standard3_id, 'admin', user_admin_standard_id);

    -- Créer les quotas appropriés selon les plans
    INSERT INTO public.search_quotas (user_id, plan_type, searches_limit, exports_limit, searches_used, exports_used) VALUES
    -- Supra admin - accès illimité (premium)
    (user_supra_admin_id, 'premium', 500, 1000, 0, 0),
    -- Premium - 500 recherches, 1000 exports
    (user_admin_premium_id, 'premium', 500, 1000, 0, 0),
    -- Freemium - 10 recherches, 0 exports
    (user_lecteur_freemium_id, 'freemium', 10, 0, 0, 0),
    -- Standard - 100 recherches, 0 exports  
    (user_lecteur_standard_id, 'standard', 100, 0, 0, 0),
    (user_gestionnaire_standard_id, 'standard', 100, 0, 0, 0),
    -- Freemium - 10 recherches, 0 exports
    (user_admin_freemium_id, 'freemium', 10, 0, 0, 0),
    -- Standard - 100 recherches, 0 exports
    (user_admin_standard_id, 'standard', 100, 0, 0, 0);

    -- Ajouter des logs d'audit pour la création de l'environnement de test
    INSERT INTO public.audit_logs (user_id, action, details) VALUES
    (user_supra_admin_id, 'test_environment_setup', 
     jsonb_build_object(
       'message', 'Environnement de test créé avec succès',
       'accounts_created', 7,
       'workspaces_created', 6,
       'configuration', jsonb_build_object(
         'axelgirard.pro+dev@gmail.com', jsonb_build_object('role', 'supra_admin', 'user_id', user_supra_admin_id),
         'axelgirard.pro@gmail.com', jsonb_build_object('role', 'admin', 'plan', 'premium', 'user_id', user_admin_premium_id),
         'axelgirard69@gmail.com', jsonb_build_object('role', 'lecteur', 'plan', 'freemium', 'user_id', user_lecteur_freemium_id),
         'axelgirard69+1@gmail.com', jsonb_build_object('role', 'lecteur', 'plan', 'standard', 'user_id', user_lecteur_standard_id),
         'axelgirard69+2@gmail.com', jsonb_build_object('role', 'gestionnaire', 'plan', 'standard', 'user_id', user_gestionnaire_standard_id),
         'axelgirard69+3@gmail.com', jsonb_build_object('role', 'admin', 'plan', 'freemium', 'user_id', user_admin_freemium_id),
         'axelgirard69+4@gmail.com', jsonb_build_object('role', 'admin', 'plan', 'standard', 'user_id', user_admin_standard_id)
       )
     ));
END $$;