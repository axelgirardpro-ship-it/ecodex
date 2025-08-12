-- Maintenant que AuthContext utilise directement workspaces, 
-- on peut supprimer la vue workspace_plans qui n'est plus nécessaire

DROP VIEW IF EXISTS public.workspace_plans;