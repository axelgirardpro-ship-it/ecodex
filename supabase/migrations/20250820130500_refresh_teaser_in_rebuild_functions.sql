-- Surcharger les fonctions de rebuild pour rafraîchir la MV teaser

CREATE OR REPLACE FUNCTION public.rebuild_emission_factors_all_search()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('statement_timeout', '0', true);

  TRUNCATE TABLE public.emission_factors_all_search;

  INSERT INTO public.emission_factors_all_search (
    object_id, record_id, scope, workspace_id, access_level, assigned_workspace_ids, languages,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "FE","Date","Incertitude","Source"
  )
  SELECT
    ef.id as object_id,
    ef.id as record_id,
    CASE WHEN ef.workspace_id IS NULL THEN 'public' ELSE 'private' END as scope,
    ef.workspace_id,
    fs.access_level,
    (
      SELECT array_agg(ws.workspace_id)
      FROM public.fe_source_workspace_assignments ws
      WHERE ws.source_name = ef."Source"
    ) as assigned_workspace_ids,
    ARRAY['fr']::text[] as languages,
    ef."Nom" as "Nom_fr",
    ef."Description" as "Description_fr",
    ef."Commentaires" as "Commentaires_fr",
    ef."Secteur" as "Secteur_fr",
    ef."Sous-secteur" as "Sous-secteur_fr",
    ef."Périmètre" as "Périmètre_fr",
    ef."Localisation" as "Localisation_fr",
    ef."Unité donnée d'activité" as "Unite_fr",
    nullif(ef."FE", '')::numeric as "FE",
    CASE WHEN ef."Date" ~ '^\d+$' THEN ef."Date"::integer ELSE NULL END as "Date",
    ef."Incertitude" as "Incertitude",
    ef."Source" as "Source"
  FROM public.emission_factors ef
  JOIN public.fe_sources fs ON fs.source_name = ef."Source"
  WHERE ef.is_latest = true;

  RAISE NOTICE 'ef_all projection rebuilt: % rows', (SELECT count(*) FROM public.emission_factors_all_search);

  -- Rafraîchir la MV teaser en fin de rebuild
  PERFORM public.refresh_emission_factors_teaser_public_fr();
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_projection_for_source(p_source text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.emission_factors_all_search WHERE "Source" = p_source;

  INSERT INTO public.emission_factors_all_search (
    object_id, record_id, scope, workspace_id, access_level, assigned_workspace_ids, languages,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "FE","Date","Incertitude","Source"
  )
  SELECT
    ef.id as object_id,
    ef.id as record_id,
    CASE WHEN ef.workspace_id IS NULL THEN 'public' ELSE 'private' END as scope,
    ef.workspace_id,
    fs.access_level,
    (
      SELECT array_agg(ws.workspace_id)
      FROM public.fe_source_workspace_assignments ws
      WHERE ws.source_name = ef."Source"
    ) as assigned_workspace_ids,
    ARRAY['fr']::text[] as languages,
    ef."Nom" as "Nom_fr",
    ef."Description" as "Description_fr",
    ef."Commentaires" as "Commentaires_fr",
    ef."Secteur" as "Secteur_fr",
    ef."Sous-secteur" as "Sous-secteur_fr",
    ef."Périmètre" as "Périmètre_fr",
    ef."Localisation" as "Localisation_fr",
    ef."Unité donnée d'activité" as "Unite_fr",
    nullif(ef."FE", '')::numeric as "FE",
    CASE WHEN ef."Date" ~ '^\d+$' THEN ef."Date"::integer ELSE NULL END as "Date",
    ef."Incertitude" as "Incertitude",
    ef."Source" as "Source"
  FROM public.emission_factors ef
  JOIN public.fe_sources fs ON fs.source_name = ef."Source"
  WHERE ef.is_latest = true AND ef."Source" = p_source;

  RAISE NOTICE 'ef_all refreshed for source: %', p_source;

  -- Rafraîchir la MV teaser après refresh ciblé
  PERFORM public.refresh_emission_factors_teaser_public_fr();
END;
$$;
