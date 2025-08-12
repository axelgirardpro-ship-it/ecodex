-- Créer les données pour l'utilisateur axelgirard.pro@gmail.com existant
-- ID utilisateur: d6846f0e-31d0-4b4a-b287-07d79b7ff7b7

-- 1. Créer le workspace si il n'existe pas
INSERT INTO public.workspaces (id, name, owner_id, plan_type)
SELECT '11111111-1111-1111-1111-111111111111', 'Axel Workspace', 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7', 'premium'
WHERE NOT EXISTS (
    SELECT 1 FROM public.workspaces WHERE id = '11111111-1111-1111-1111-111111111111'
);

-- 2. Créer le profil si il n'existe pas 
INSERT INTO public.profiles (user_id, first_name, last_name, workspace_id) 
SELECT 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7', 'Axel', 'Girard', '11111111-1111-1111-1111-111111111111'
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7'
);

-- 3. Créer le rôle admin si il n'existe pas
INSERT INTO public.user_roles (user_id, workspace_id, role, assigned_by)
SELECT 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7', '11111111-1111-1111-1111-111111111111', 'admin', 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7'
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7' 
    AND workspace_id = '11111111-1111-1111-1111-111111111111'
);

-- 4. Créer l'abonnement si il n'existe pas
INSERT INTO public.subscribers (user_id, email, plan_type, trial_end, subscribed)
SELECT 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7', 'axelgirard.pro@gmail.com', 'premium', now() + interval '30 days', true
WHERE NOT EXISTS (
    SELECT 1 FROM public.subscribers WHERE user_id = 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7'
);

-- 5. Créer le quota de recherche si il n'existe pas
INSERT INTO public.search_quotas (user_id, plan_type, searches_limit, exports_limit)
SELECT 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7', 'premium', 1000, 500
WHERE NOT EXISTS (
    SELECT 1 FROM public.search_quotas WHERE user_id = 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7'
);