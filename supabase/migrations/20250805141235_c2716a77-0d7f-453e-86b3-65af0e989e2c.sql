-- Supprimer la colonne plan_tier obsolète de la table emission_factors
-- Cette colonne n'est plus utilisée depuis l'implémentation du système fe_sources
ALTER TABLE public.emission_factors DROP COLUMN plan_tier;