-- Nettoyer les résidus de migration

-- 1. Supprimer la table users_new qui est un résidu de la migration
DROP TABLE IF EXISTS public.users_new;

-- 2. Vérifier si la vue workspace_plans est encore nécessaire
-- (nous la garderons pour l'instant car elle peut être utilisée par le code)