-- Créer les données pour l'utilisateur axelgirard.pro@gmail.com existant
-- ID utilisateur: d6846f0e-31d0-4b4a-b287-07d79b7ff7b7

-- 1. D'abord créer le workspace
INSERT INTO public.workspaces (id, name, owner_id, plan_type)
VALUES ('11111111-1111-1111-1111-111111111111', 'Axel Workspace', 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7', 'premium')
ON CONFLICT (id) 
DO UPDATE SET 
  name = 'Axel Workspace',
  owner_id = 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7',
  plan_type = 'premium';

-- 2. Ensuite créer ou mettre à jour le profil
INSERT INTO public.profiles (user_id, first_name, last_name, workspace_id) 
VALUES ('d6846f0e-31d0-4b4a-b287-07d79b7ff7b7', 'Axel', 'Girard', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (user_id) 
DO UPDATE SET 
  first_name = 'Axel',
  last_name = 'Girard',
  workspace_id = '11111111-1111-1111-1111-111111111111';

-- 3. Assigner un rôle admin à cet utilisateur
INSERT INTO public.user_roles (user_id, workspace_id, role, assigned_by)
VALUES ('d6846f0e-31d0-4b4a-b287-07d79b7ff7b7', '11111111-1111-1111-1111-111111111111', 'admin', 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7')
ON CONFLICT (user_id, workspace_id) 
DO UPDATE SET 
  role = 'admin',
  assigned_by = 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7';

-- 4. Créer l'abonnement premium
INSERT INTO public.subscribers (user_id, email, plan_type, trial_end, subscribed)
VALUES ('d6846f0e-31d0-4b4a-b287-07d79b7ff7b7', 'axelgirard.pro@gmail.com', 'premium', now() + interval '30 days', true)
ON CONFLICT (user_id) 
DO UPDATE SET 
  plan_type = 'premium',
  trial_end = now() + interval '30 days',
  subscribed = true;

-- 5. Créer le quota de recherche premium
INSERT INTO public.search_quotas (user_id, plan_type, searches_limit, exports_limit)
VALUES ('d6846f0e-31d0-4b4a-b287-07d79b7ff7b7', 'premium', 1000, 500)
ON CONFLICT (user_id) 
DO UPDATE SET 
  plan_type = 'premium',
  searches_limit = 1000,
  exports_limit = 500;