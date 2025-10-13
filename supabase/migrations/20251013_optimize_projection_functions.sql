-- Migration: Optimize projection functions for better performance
-- Date: 2025-10-13
-- Issue: Unnecessary type casts in refresh_ef_all_for_source and rebuild_emission_factors_all_search
-- Solution: Use direct casts for emission_factors (already typed), keep safe conversions for user_factor_overlays (text)

CREATE OR REPLACE FUNCTION public.refresh_ef_all_for_source(p_source text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_source IS NULL OR length(p_source) = 0 THEN
    RAISE NOTICE 'refresh_ef_all_for_source: source vide';
    RETURN;
  END IF;

  DELETE FROM public.emission_factors_all_search WHERE "Source" = p_source;

  -- Insertion depuis emission_factors (colonnes déjà typées correctement)
  INSERT INTO public.emission_factors_all_search (
    object_id, scope, workspace_id, access_level, assigned_workspace_ids,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "FE","Date","Incertitude","Source","is_blurred","variant",
    "Contributeur","Méthodologie","Type_de_données",
    "Contributeur_en","Méthodologie_en","Type_de_données_en",
    "ID_FE"
  )
  SELECT
    ef."ID_FE" AS object_id,
    'public' AS scope,
    NULL AS workspace_id,
    fs.access_level,
    (
      SELECT array_agg(ws.workspace_id)
      FROM public.fe_source_workspace_assignments ws
      WHERE ws.source_name = ef."Source"
    ) AS assigned_workspace_ids,
    ef."Nom"                AS "Nom_fr",
    ef."Description"        AS "Description_fr",
    ef."Commentaires"       AS "Commentaires_fr",
    ef."Secteur"            AS "Secteur_fr",
    ef."Sous-secteur"       AS "Sous-secteur_fr",
    ef."Périmètre"          AS "Périmètre_fr",
    ef."Localisation"       AS "Localisation_fr",
    ef."Unité donnée d'activité" AS "Unite_fr",
    ef."Nom_en"             AS "Nom_en",
    ef."Description_en"     AS "Description_en",
    ef."Commentaires_en"    AS "Commentaires_en",
    ef."Secteur_en"         AS "Secteur_en",
    ef."Sous-secteur_en"    AS "Sous-secteur_en",
    ef."Périmètre_en"       AS "Périmètre_en",
    ef."Localisation_en"    AS "Localisation_en",
    ef."Unite_en"           AS "Unite_en",
    ef."FE"::numeric        AS "FE", -- Direct cast from double precision to numeric
    ef."Date"::integer      AS "Date", -- Direct cast from double precision to integer
    ef."Incertitude"        AS "Incertitude",
    ef."Source"             AS "Source",
    false                   AS "is_blurred",
    'full'                  AS "variant",
    ef."Contributeur"       AS "Contributeur",
    ef."Méthodologie"       AS "Méthodologie",
    ef."Type_de_données"    AS "Type_de_données",
    ef."Contributeur_en"    AS "Contributeur_en",
    ef."Méthodologie_en"    AS "Méthodologie_en",
    ef."Type_de_données_en" AS "Type_de_données_en",
    ef."ID_FE"              AS "ID_FE"
  FROM public.emission_factors ef
  JOIN public.fe_sources fs ON fs.source_name = ef."Source"
  WHERE ef."Source" = p_source;

  -- Insertion depuis user_factor_overlays (colonnes en text, conversion sécurisée nécessaire)
  INSERT INTO public.emission_factors_all_search (
    object_id, scope, workspace_id, access_level, assigned_workspace_ids,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "FE","Date","Incertitude","Source","is_blurred","variant",
    "Contributeur","Méthodologie","Type_de_données",
    "Contributeur_en","Méthodologie_en","Type_de_données_en",
    "ID_FE"
  )
  SELECT
    ufo.overlay_id AS object_id,
    'private' AS scope,
    ufo.workspace_id,
    coalesce(fs.access_level, 'standard') AS access_level,
    (
      SELECT array_agg(ws.workspace_id)
      FROM public.fe_source_workspace_assignments ws
      WHERE ws.source_name = ufo."Source"
    ) AS assigned_workspace_ids,
    ufo."Nom"                AS "Nom_fr",
    ufo."Description"        AS "Description_fr",
    ufo."Commentaires"       AS "Commentaires_fr",
    ufo."Secteur"            AS "Secteur_fr",
    ufo."Sous-secteur"       AS "Sous-secteur_fr",
    ufo."Périmètre"          AS "Périmètre_fr",
    ufo."Localisation"       AS "Localisation_fr",
    ufo."Unité donnée d'activité" AS "Unite_fr",
    ufo."Nom_en"             AS "Nom_en",
    ufo."Description_en"     AS "Description_en",
    ufo."Commentaires_en"    AS "Commentaires_en",
    ufo."Secteur_en"         AS "Secteur_en",
    ufo."Sous-secteur_en"    AS "Sous-secteur_en",
    ufo."Périmètre_en"       AS "Périmètre_en",
    ufo."Localisation_en"    AS "Localisation_en",
    ufo."Unite_en"           AS "Unite_en",
    public.safe_to_numeric(coalesce(nullif(ufo."FE", ''), null)) AS "FE", -- Safe conversion from text
    CASE WHEN trim(coalesce(ufo."Date",'')) ~ '^\d+$' THEN trim(ufo."Date")::integer ELSE NULL END AS "Date", -- Safe conversion from text
    ufo."Incertitude"        AS "Incertitude",
    ufo."Source"             AS "Source",
    false                    AS "is_blurred",
    'full'                   AS "variant",
    ufo."Contributeur"       AS "Contributeur",
    ufo."Méthodologie"       AS "Méthodologie",
    ufo."Type_de_données"    AS "Type_de_données",
    ufo."Contributeur_en"    AS "Contributeur_en",
    ufo."Méthodologie_en"    AS "Méthodologie_en",
    ufo."Type_de_données_en" AS "Type_de_données_en",
    NULL                     AS "ID_FE"
  FROM public.user_factor_overlays ufo
  LEFT JOIN public.fe_sources fs ON fs.source_name = ufo."Source"
  WHERE ufo."Source" = p_source;

  ANALYZE public.emission_factors_all_search;
END;
$$;

CREATE OR REPLACE FUNCTION public.rebuild_emission_factors_all_search()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  TRUNCATE TABLE public.emission_factors_all_search;

  -- Insertion depuis emission_factors (colonnes déjà typées correctement)
  INSERT INTO public.emission_factors_all_search (
    object_id, scope, workspace_id, access_level, assigned_workspace_ids,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "FE","Date","Incertitude","Source","is_blurred","variant",
    "Contributeur","Méthodologie","Type_de_données",
    "Contributeur_en","Méthodologie_en","Type_de_données_en",
    "ID_FE"
  )
  SELECT
    ef."ID_FE" AS object_id,
    'public' AS scope,
    NULL AS workspace_id,
    fs.access_level,
    (
      SELECT array_agg(ws.workspace_id)
      FROM public.fe_source_workspace_assignments ws
      WHERE ws.source_name = ef."Source"
    ) AS assigned_workspace_ids,
    ef."Nom"                AS "Nom_fr",
    ef."Description"        AS "Description_fr",
    ef."Commentaires"       AS "Commentaires_fr",
    ef."Secteur"            AS "Secteur_fr",
    ef."Sous-secteur"       AS "Sous-secteur_fr",
    ef."Périmètre"          AS "Périmètre_fr",
    ef."Localisation"       AS "Localisation_fr",
    ef."Unité donnée d'activité" AS "Unite_fr",
    ef."Nom_en"             AS "Nom_en",
    ef."Description_en"     AS "Description_en",
    ef."Commentaires_en"    AS "Commentaires_en",
    ef."Secteur_en"         AS "Secteur_en",
    ef."Sous-secteur_en"    AS "Sous-secteur_en",
    ef."Périmètre_en"       AS "Périmètre_en",
    ef."Localisation_en"    AS "Localisation_en",
    ef."Unite_en"           AS "Unite_en",
    ef."FE"::numeric        AS "FE", -- Direct cast from double precision to numeric
    ef."Date"::integer      AS "Date", -- Direct cast from double precision to integer
    ef."Incertitude"        AS "Incertitude",
    ef."Source"             AS "Source",
    false                   AS "is_blurred",
    'full'                  AS "variant",
    ef."Contributeur"       AS "Contributeur",
    ef."Méthodologie"       AS "Méthodologie",
    ef."Type_de_données"    AS "Type_de_données",
    ef."Contributeur_en"    AS "Contributeur_en",
    ef."Méthodologie_en"    AS "Méthodologie_en",
    ef."Type_de_données_en" AS "Type_de_données_en",
    ef."ID_FE"              AS "ID_FE"
  FROM public.emission_factors ef
  JOIN public.fe_sources fs ON fs.source_name = ef."Source";

  -- Insertion depuis user_factor_overlays (colonnes en text, conversion sécurisée nécessaire)
  INSERT INTO public.emission_factors_all_search (
    object_id, scope, workspace_id, access_level, assigned_workspace_ids,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "FE","Date","Incertitude","Source","is_blurred","variant",
    "Contributeur","Méthodologie","Type_de_données",
    "Contributeur_en","Méthodologie_en","Type_de_données_en",
    "ID_FE"
  )
  SELECT
    ufo.overlay_id AS object_id,
    'private' AS scope,
    ufo.workspace_id,
    coalesce(fs.access_level, 'standard') AS access_level,
    (
      SELECT array_agg(ws.workspace_id)
      FROM public.fe_source_workspace_assignments ws
      WHERE ws.source_name = ufo."Source"
    ) AS assigned_workspace_ids,
    ufo."Nom"                AS "Nom_fr",
    ufo."Description"        AS "Description_fr",
    ufo."Commentaires"       AS "Commentaires_fr",
    ufo."Secteur"            AS "Secteur_fr",
    ufo."Sous-secteur"       AS "Sous-secteur_fr",
    ufo."Périmètre"          AS "Périmètre_fr",
    ufo."Localisation"       AS "Localisation_fr",
    ufo."Unité donnée d'activité" AS "Unite_fr",
    ufo."Nom_en"             AS "Nom_en",
    ufo."Description_en"     AS "Description_en",
    ufo."Commentaires_en"    AS "Commentaires_en",
    ufo."Secteur_en"         AS "Secteur_en",
    ufo."Sous-secteur_en"    AS "Sous-secteur_en",
    ufo."Périmètre_en"       AS "Périmètre_en",
    ufo."Localisation_en"    AS "Localisation_en",
    ufo."Unite_en"           AS "Unite_en",
    public.safe_to_numeric(coalesce(nullif(ufo."FE", ''), null)) AS "FE", -- Safe conversion from text
    CASE WHEN trim(coalesce(ufo."Date",'')) ~ '^\d+$' THEN trim(ufo."Date")::integer ELSE NULL END AS "Date", -- Safe conversion from text
    ufo."Incertitude"        AS "Incertitude",
    ufo."Source"             AS "Source",
    false                    AS "is_blurred",
    'full'                   AS "variant",
    ufo."Contributeur"       AS "Contributeur",
    ufo."Méthodologie"       AS "Méthodologie",
    ufo."Type_de_données"    AS "Type_de_données",
    ufo."Contributeur_en"    AS "Contributeur_en",
    ufo."Méthodologie_en"    AS "Méthodologie_en",
    ufo."Type_de_données_en" AS "Type_de_données_en",
    NULL                     AS "ID_FE"
  FROM public.user_factor_overlays ufo
  LEFT JOIN public.fe_sources fs ON fs.source_name = ufo."Source";

  ANALYZE public.emission_factors_all_search;
END;
$$;

COMMENT ON FUNCTION public.refresh_ef_all_for_source(text) IS 'Rafraîchit emission_factors_all_search pour une source - optimisé avec casts directs pour emission_factors';
COMMENT ON FUNCTION public.rebuild_emission_factors_all_search() IS 'Rebuild complet de emission_factors_all_search - optimisé avec casts directs pour emission_factors';

