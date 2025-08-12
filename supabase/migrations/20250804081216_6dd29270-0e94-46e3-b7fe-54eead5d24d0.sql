-- Créer temporairement un utilisateur pour le développement
-- Note: Ceci sera fait via l'interface d'administration Supabase normalement
-- Pour le moment, on s'assure que l'authentification par email/password est activée

-- Vérifier que les tables nécessaires existent pour l'utilisateur
-- (normalement géré par Supabase Auth automatiquement)

-- Insérer dans la table profiles si l'utilisateur n'existe pas déjà
INSERT INTO public.profiles (user_id, first_name, last_name) 
SELECT 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7', 'Axel', 'Girard'
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7'
);

-- Créer une entreprise pour cet utilisateur si elle n'existe pas
INSERT INTO public.companies (id, name, owner_id, plan_type)
SELECT '11111111-1111-1111-1111-111111111111', 'Axel Company', 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7', 'premium'
WHERE NOT EXISTS (
    SELECT 1 FROM public.companies WHERE owner_id = 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7'
);

-- Créer le workspace correspondant
INSERT INTO public.workspaces (id, name, owner_id, plan_type)
SELECT '11111111-1111-1111-1111-111111111111', 'Axel Workspace', 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7', 'premium'
WHERE NOT EXISTS (
    SELECT 1 FROM public.workspaces WHERE owner_id = 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7'
);

-- Assigner un rôle admin à cet utilisateur
INSERT INTO public.user_roles (user_id, workspace_id, role, assigned_by)
SELECT 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7', '11111111-1111-1111-1111-111111111111', 'admin', 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7'
WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7' 
    AND workspace_id = '11111111-1111-1111-1111-111111111111'
);

-- Créer l'abonnement
INSERT INTO public.subscribers (user_id, email, plan_type, trial_end)
SELECT 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7', 'axelgirard.pro@gmail.com', 'premium', now() + interval '30 days'
WHERE NOT EXISTS (
    SELECT 1 FROM public.subscribers WHERE user_id = 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7'
);

-- Créer le quota de recherche
INSERT INTO public.search_quotas (user_id, plan_type)
SELECT 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7', 'premium'
WHERE NOT EXISTS (
    SELECT 1 FROM public.search_quotas WHERE user_id = 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7'
);