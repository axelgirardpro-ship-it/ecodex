-- Migration: Vue avec comptage des enregistrements par source
-- Objectif: Filtrer les sources affichées dans /admin pour n'afficher que celles 
--           avec des enregistrements dans emission_factors_all_search

-- Vue pour compter les enregistrements par source
CREATE OR REPLACE VIEW public.fe_sources_with_counts AS
SELECT 
  fs.source_name,
  fs.access_level,
  fs.is_global,
  COUNT(DISTINCT efs.object_id) as record_count
FROM public.fe_sources fs
LEFT JOIN public.emission_factors_all_search efs 
  ON efs."Source" = fs.source_name
WHERE fs.is_global = true
GROUP BY fs.source_name, fs.access_level, fs.is_global;

COMMENT ON VIEW public.fe_sources_with_counts IS
'Sources globales avec le nombre d''enregistrements dans emission_factors_all_search.
Utilisée par le frontend pour afficher uniquement les sources ayant des données (record_count > 0).
Évite d''afficher des sources "fantômes" qui n''ont plus d''enregistrements après les imports récents.';

-- Créer des RLS policies pour la vue (hérite des policies de fe_sources)
ALTER VIEW public.fe_sources_with_counts SET (security_invoker = true);

-- Grant access pour les utilisateurs authentifiés
GRANT SELECT ON public.fe_sources_with_counts TO authenticated;
GRANT SELECT ON public.fe_sources_with_counts TO anon;

