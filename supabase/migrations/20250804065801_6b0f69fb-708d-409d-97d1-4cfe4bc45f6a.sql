-- Supprimer le trigger obsolète qui référence la table database_plan_access supprimée
DROP TRIGGER IF EXISTS trigger_create_database_access ON public.emission_factors;

-- Supprimer la fonction obsolète qui tentait de créer des accès dans database_plan_access
DROP FUNCTION IF EXISTS public.create_database_access_for_new_source();