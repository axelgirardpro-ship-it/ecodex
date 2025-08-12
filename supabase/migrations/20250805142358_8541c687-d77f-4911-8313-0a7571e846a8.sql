-- Nettoyage des données résiduelles et création d'environnement de test

-- 1. NETTOYAGE DES DONNÉES RÉSIDUELLES pour axelgirard69@gmail.com
-- Supprimer toutes les traces de l'ancien compte a987ba76-4a59-4977-b5b4-7e1c48d77acf

-- Supprimer les données des tables dépendantes d'abord
DELETE FROM public.search_history WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.search_quotas WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.favorites WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.audit_logs WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.user_roles WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.users WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';

-- Supprimer le workspace orphelin (cela va cascader automatiquement)
DELETE FROM public.workspaces WHERE owner_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';

-- 2. CRÉATION DE L'ENVIRONNEMENT DE TEST

-- Variables pour les nouveaux user_ids (simulés)
-- Note: En réalité, ces IDs seront générés par Supabase Auth lors de la connexion SSO

-- Créer les workspaces de test
INSERT INTO public.workspaces (id, name, owner_id, plan_type) VALUES
-- Workspace premium pour axelgirard.pro@gmail.com
('11111111-1111-1111-1111-111111111111', 'Premium Workspace', '22222222-2222-2222-2222-222222222222', 'premium'),
-- Workspace freemium pour axelgirard69@gmail.com  
('33333333-3333-3333-3333-333333333333', 'Freemium Workspace 1', '44444444-4444-4444-4444-444444444444', 'freemium'),
-- Workspace standard pour axelgirard69+1@gmail.com
('55555555-5555-5555-5555-555555555555', 'Standard Workspace 1', '66666666-6666-6666-6666-666666666666', 'standard'),
-- Workspace standard pour axelgirard69+2@gmail.com  
('77777777-7777-7777-7777-777777777777', 'Standard Workspace 2', '88888888-8888-8888-8888-888888888888', 'standard'),
-- Workspace freemium pour axelgirard69+3@gmail.com
('99999999-9999-9999-9999-999999999999', 'Freemium Workspace 2', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'freemium'),
-- Workspace standard pour axelgirard69+4@gmail.com
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Standard Workspace 3', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'standard');

-- Créer les utilisateurs de test dans la table users
INSERT INTO public.users (user_id, workspace_id, first_name, last_name, company, email, plan_type, subscribed) VALUES
-- axelgirard.pro@gmail.com - admin workspace premium
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Axel', 'Girard', 'Premium Company', 'axelgirard.pro@gmail.com', 'premium', true),
-- axelgirard69@gmail.com - lecteur workspace freemium
('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Axel', 'Test1', 'Freemium Company 1', 'axelgirard69@gmail.com', 'freemium', false),
-- axelgirard69+1@gmail.com - lecteur workspace standard  
('66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555555', 'Axel', 'Test2', 'Standard Company 1', 'axelgirard69+1@gmail.com', 'standard', false),
-- axelgirard69+2@gmail.com - gestionnaire workspace standard
('88888888-8888-8888-8888-888888888888', '77777777-7777-7777-7777-777777777777', 'Axel', 'Test3', 'Standard Company 2', 'axelgirard69+2@gmail.com', 'standard', false),
-- axelgirard69+3@gmail.com - admin workspace freemium
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999999', 'Axel', 'Test4', 'Freemium Company 2', 'axelgirard69+3@gmail.com', 'freemium', false),
-- axelgirard69+4@gmail.com - admin workspace standard
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Axel', 'Test5', 'Standard Company 3', 'axelgirard69+4@gmail.com', 'standard', false);

-- Créer les rôles utilisateurs
INSERT INTO public.user_roles (user_id, workspace_id, role, assigned_by) VALUES
-- Supra admin global (pas de workspace spécifique)
('11111111-1111-1111-1111-111111111111', NULL, 'supra_admin', '11111111-1111-1111-1111-111111111111'),
-- Admin workspace premium
('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'admin', '22222222-2222-2222-2222-222222222222'),
-- Lecteur workspace freemium  
('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'lecteur', '44444444-4444-4444-4444-444444444444'),
-- Lecteur workspace standard
('66666666-6666-6666-6666-666666666666', '55555555-5555-5555-5555-555555555555', 'lecteur', '66666666-6666-6666-6666-666666666666'),
-- Gestionnaire workspace standard
('88888888-8888-8888-8888-888888888888', '77777777-7777-7777-7777-777777777777', 'gestionnaire', '88888888-8888-8888-8888-888888888888'),
-- Admin workspace freemium
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '99999999-9999-9999-9999-999999999999', 'admin', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
-- Admin workspace standard
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'admin', 'cccccccc-cccc-cccc-cccc-cccccccccccc');

-- Créer les quotas appropriés selon les plans
INSERT INTO public.search_quotas (user_id, plan_type, searches_limit, exports_limit, searches_used, exports_used) VALUES
-- Supra admin - accès illimité (premium)
('11111111-1111-1111-1111-111111111111', 'premium', 500, 1000, 0, 0),
-- Premium - 500 recherches, 1000 exports
('22222222-2222-2222-2222-222222222222', 'premium', 500, 1000, 0, 0),
-- Freemium - 10 recherches, 0 exports
('44444444-4444-4444-4444-444444444444', 'freemium', 10, 0, 0, 0),
-- Standard - 100 recherches, 0 exports  
('66666666-6666-6666-6666-666666666666', 'standard', 100, 0, 0, 0),
('88888888-8888-8888-8888-888888888888', 'standard', 100, 0, 0, 0),
-- Freemium - 10 recherches, 0 exports
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'freemium', 10, 0, 0, 0),
-- Standard - 100 recherches, 0 exports
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'standard', 100, 0, 0, 0);

-- Ajouter des logs d'audit pour la création de l'environnement de test
INSERT INTO public.audit_logs (user_id, action, details) VALUES
('11111111-1111-1111-1111-111111111111', 'test_environment_setup', 
 '{"message": "Environnement de test créé", "accounts_created": 7, "workspaces_created": 6}');

-- Commentaire de fin pour documentation
-- ENVIRONNEMENT DE TEST CRÉÉ:
-- axelgirard.pro+dev@gmail.com (ID: 11111111-1111-1111-1111-111111111111) -> supra_admin global
-- axelgirard.pro@gmail.com (ID: 22222222-2222-2222-2222-222222222222) -> admin workspace premium  
-- axelgirard69@gmail.com (ID: 44444444-4444-4444-4444-444444444444) -> lecteur workspace freemium
-- axelgirard69+1@gmail.com (ID: 66666666-6666-6666-6666-666666666666) -> lecteur workspace standard
-- axelgirard69+2@gmail.com (ID: 88888888-8888-8888-8888-888888888888) -> gestionnaire workspace standard  
-- axelgirard69+3@gmail.com (ID: aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa) -> admin workspace freemium
-- axelgirard69+4@gmail.com (ID: cccccccc-cccc-cccc-cccc-cccccccccccc) -> admin workspace standard