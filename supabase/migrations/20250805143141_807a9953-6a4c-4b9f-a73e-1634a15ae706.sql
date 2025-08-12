-- Nettoyage et environnement de test (version simplifiée sans foreign key constraints)

-- 1. NETTOYAGE DES DONNÉES RÉSIDUELLES
DELETE FROM public.search_history WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.search_quotas WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.favorites WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.audit_logs WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.user_roles WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.users WHERE user_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';
DELETE FROM public.workspaces WHERE owner_id = 'a987ba76-4a59-4977-b5b4-7e1c48d77acf';

-- 2. CRÉATION DE L'ENVIRONNEMENT DE TEST (séparé en étapes)

-- Créer les workspaces d'abord
INSERT INTO public.workspaces (id, name, owner_id, plan_type) VALUES
('10000000-0000-0000-0000-000000000001', 'Premium Workspace', 'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2', 'premium'),
('10000000-0000-0000-0000-000000000002', 'Freemium Workspace 1', 'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3', 'freemium'),
('10000000-0000-0000-0000-000000000003', 'Standard Workspace 1', 'e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4', 'standard'),
('10000000-0000-0000-0000-000000000004', 'Standard Workspace 2', 'e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5', 'standard'),
('10000000-0000-0000-0000-000000000005', 'Freemium Workspace 2', 'e6e6e6e6-e6e6-e6e6-e6e6-e6e6e6e6e6e6', 'freemium'),
('10000000-0000-0000-0000-000000000006', 'Standard Workspace 3', 'e7e7e7e7-e7e7-e7e7-e7e7-e7e7e7e7e7e7', 'standard');

-- Créer les utilisateurs de test
INSERT INTO public.users (user_id, workspace_id, first_name, last_name, company, email, plan_type, subscribed) VALUES
-- Supra admin dans le premium workspace pour pouvoir avoir des quotas
('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', '10000000-0000-0000-0000-000000000001', 'Axel', 'SupraAdmin', 'Global Admin', 'axelgirard.pro+dev@gmail.com', 'premium', true),
-- Admin workspace premium
('e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2', '10000000-0000-0000-0000-000000000001', 'Axel', 'Girard', 'Premium Company', 'axelgirard.pro@gmail.com', 'premium', true),
-- Lecteur workspace freemium
('e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3', '10000000-0000-0000-0000-000000000002', 'Axel', 'Test1', 'Freemium Company 1', 'axelgirard69@gmail.com', 'freemium', false),
-- Lecteur workspace standard  
('e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4', '10000000-0000-0000-0000-000000000003', 'Axel', 'Test2', 'Standard Company 1', 'axelgirard69+1@gmail.com', 'standard', false),
-- Gestionnaire workspace standard
('e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5', '10000000-0000-0000-0000-000000000004', 'Axel', 'Test3', 'Standard Company 2', 'axelgirard69+2@gmail.com', 'standard', false),
-- Admin workspace freemium
('e6e6e6e6-e6e6-e6e6-e6e6-e6e6e6e6e6e6', '10000000-0000-0000-0000-000000000005', 'Axel', 'Test4', 'Freemium Company 2', 'axelgirard69+3@gmail.com', 'freemium', false),
-- Admin workspace standard
('e7e7e7e7-e7e7-e7e7-e7e7-e7e7e7e7e7e7', '10000000-0000-0000-0000-000000000006', 'Axel', 'Test5', 'Standard Company 3', 'axelgirard69+4@gmail.com', 'standard', false);

-- Créer les rôles utilisateurs
INSERT INTO public.user_roles (user_id, workspace_id, role, assigned_by) VALUES
-- Supra admin global
('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', NULL, 'supra_admin', 'e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1'),
-- Admin workspace premium
('e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2', '10000000-0000-0000-0000-000000000001', 'admin', 'e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2'),
-- Lecteur workspace freemium  
('e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3', '10000000-0000-0000-0000-000000000002', 'lecteur', 'e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3'),
-- Lecteur workspace standard
('e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4', '10000000-0000-0000-0000-000000000003', 'lecteur', 'e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4'),
-- Gestionnaire workspace standard
('e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5', '10000000-0000-0000-0000-000000000004', 'gestionnaire', 'e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5'),
-- Admin workspace freemium
('e6e6e6e6-e6e6-e6e6-e6e6-e6e6e6e6e6e6', '10000000-0000-0000-0000-000000000005', 'admin', 'e6e6e6e6-e6e6-e6e6-e6e6-e6e6e6e6e6e6'),
-- Admin workspace standard
('e7e7e7e7-e7e7-e7e7-e7e7-e7e7e7e7e7e7', '10000000-0000-0000-0000-000000000006', 'admin', 'e7e7e7e7-e7e7-e7e7-e7e7-e7e7e7e7e7e7');

-- Créer les quotas appropriés
INSERT INTO public.search_quotas (user_id, plan_type, searches_limit, exports_limit, searches_used, exports_used) VALUES
-- Supra admin
('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', 'premium', 500, 1000, 0, 0),
-- Premium
('e2e2e2e2-e2e2-e2e2-e2e2-e2e2e2e2e2e2', 'premium', 500, 1000, 0, 0),
-- Freemium
('e3e3e3e3-e3e3-e3e3-e3e3-e3e3e3e3e3e3', 'freemium', 10, 0, 0, 0),
-- Standard
('e4e4e4e4-e4e4-e4e4-e4e4-e4e4e4e4e4e4', 'standard', 100, 0, 0, 0),
('e5e5e5e5-e5e5-e5e5-e5e5-e5e5e5e5e5e5', 'standard', 100, 0, 0, 0),
-- Freemium
('e6e6e6e6-e6e6-e6e6-e6e6-e6e6e6e6e6e6', 'freemium', 10, 0, 0, 0),
-- Standard
('e7e7e7e7-e7e7-e7e7-e7e7-e7e7e7e7e7e7', 'standard', 100, 0, 0, 0);

-- Log de création
INSERT INTO public.audit_logs (user_id, action, details) VALUES
('e1e1e1e1-e1e1-e1e1-e1e1-e1e1e1e1e1e1', 'test_environment_created', 
'{"message": "Environnement de test créé", "users": 7, "workspaces": 6}');