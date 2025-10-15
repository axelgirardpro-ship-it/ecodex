-- Migration: refonte import admin (ID_FE, purge SCD1, projection stable)
-- Date: 2025-10-01

BEGIN;

-- 1. Réinitialisation
TRUNCATE TABLE public.emission_factors CASCADE;
TRUNCATE TABLE public.emission_factors_all_search;
DELETE FROM public.favorites;

-- 2. Schéma emission_factors sans SCD1, ajout ID_FE
ALTER TABLE public.emission_factors
  ADD COLUMN IF NOT EXISTS "ID_FE" text,
  DROP COLUMN IF EXISTS valid_from,
  DROP COLUMN IF EXISTS valid_to,
  DROP COLUMN IF EXISTS version_id,
  DROP COLUMN IF EXISTS is_latest;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='uniq_emission_factors_factor_key') THEN
    DROP INDEX public.uniq_emission_factors_factor_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_emission_factors_id_fe ON public.emission_factors("ID_FE");
CREATE INDEX IF NOT EXISTS idx_emission_factors_factor_key ON public.emission_factors(factor_key);
CREATE INDEX IF NOT EXISTS idx_emission_factors_source ON public.emission_factors("Source");

ALTER TABLE public.emission_factors_all_search
  ADD COLUMN IF NOT EXISTS "ID_FE" text;

-- 3. Fonctions
CREATE OR REPLACE FUNCTION public.calculate_factor_key(
  p_nom text,
  p_unite text,
  p_source text,
  p_perimetre text,
  p_localisation text,
  p_workspace_id uuid DEFAULT NULL,
  p_language text DEFAULT NULL,
  p_fe numeric DEFAULT NULL,
  p_date integer DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fe text := coalesce(to_char(p_fe, 'FM999999999.############'), '');
  v_date text := coalesce(p_date::text, '');
BEGIN
  RETURN coalesce(lower(p_nom), '') || '|' ||
         coalesce(lower(p_unite), '') || '|' ||
         coalesce(lower(p_source), '') || '|' ||
         coalesce(lower(p_perimetre), '') || '|' ||
         coalesce(lower(p_localisation), '') || '|' ||
         v_fe || '|' || v_date;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_import_from_staging()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := now();
  v_inserted int := 0;
  v_invalid int := 0;
  v_sources text[] := '{}';
BEGIN
  PERFORM set_config('statement_timeout','0', true);

  TRUNCATE TABLE public.emission_factors;

  DROP TABLE IF EXISTS temp_prepared;
  CREATE TEMPORARY TABLE temp_prepared AS
    SELECT
      coalesce(nullif(btrim("ID"), ''), gen_random_uuid()::text) AS "ID_FE",
      public.calculate_factor_key(
        coalesce(nullif(btrim("Nom"), ''), nullif(btrim("Nom_en"), '')),
        coalesce(nullif(btrim("Unité donnée d'activité"), ''), nullif(btrim("Unite_en"), '')),
        nullif(btrim("Source"), ''),
        coalesce(nullif(btrim("Périmètre"), ''), nullif(btrim("Périmètre_en"), '')),
        coalesce(nullif(btrim("Localisation"), ''), nullif(btrim("Localisation_en"), '')),
        NULL,
        NULL,
        public.safe_to_numeric(nullif(btrim("FE"), '')),
        public.safe_to_int(nullif(btrim("Date"), ''))
      ) AS factor_key,
      coalesce(nullif(btrim("Nom"), ''), nullif(btrim("Nom_en"), '')) AS "Nom",
      nullif(btrim("Nom_en"), '') AS "Nom_en",
      coalesce(nullif(btrim("Description"), ''), nullif(btrim("Description_en"), '')) AS "Description",
      nullif(btrim("Description_en"), '') AS "Description_en",
      public.safe_to_numeric(nullif(btrim("FE"), ''))::double precision AS "FE",
      coalesce(nullif(btrim("Unité donnée d'activité"), ''), nullif(btrim("Unite_en"), '')) AS "Unité donnée d'activité",
      nullif(btrim("Unite_en"), '') AS "Unite_en",
      nullif(btrim("Source"), '') AS "Source",
      coalesce(nullif(btrim("Secteur"), ''), nullif(btrim("Secteur_en"), '')) AS "Secteur",
      nullif(btrim("Secteur_en"), '') AS "Secteur_en",
      coalesce(nullif(btrim("Sous-secteur"), ''), nullif(btrim("Sous-secteur_en"), '')) AS "Sous-secteur",
      nullif(btrim("Sous-secteur_en"), '') AS "Sous-secteur_en",
      coalesce(nullif(btrim("Localisation"), ''), nullif(btrim("Localisation_en"), '')) AS "Localisation",
      nullif(btrim("Localisation_en"), '') AS "Localisation_en",
      public.safe_to_int(nullif(btrim("Date"), ''))::double precision AS "Date",
      nullif(btrim("Incertitude"), '') AS "Incertitude",
      coalesce(nullif(btrim("Périmètre"), ''), nullif(btrim("Périmètre_en"), '')) AS "Périmètre",
      nullif(btrim("Périmètre_en"), '') AS "Périmètre_en",
      nullif(btrim("Contributeur"), '') AS "Contributeur",
      nullif(btrim("Contributeur_en"), '') AS "Contributeur_en",
      nullif(btrim("Méthodologie"), '') AS "Méthodologie",
      nullif(btrim("Méthodologie_en"), '') AS "Méthodologie_en",
      nullif(btrim("Type_de_données"), '') AS "Type_de_données",
      nullif(btrim("Type_de_données_en"), '') AS "Type_de_données_en",
      nullif(btrim("Commentaires"), '') AS "Commentaires",
      nullif(btrim("Commentaires_en"), '') AS "Commentaires_en"
    FROM public.staging_emission_factors;

  DROP TABLE IF EXISTS temp_invalid;
  CREATE TEMPORARY TABLE temp_invalid AS
  SELECT * FROM temp_prepared
  WHERE "FE" IS NULL
     OR "Unité donnée d'activité" IS NULL;
  GET DIAGNOSTICS v_invalid = ROW_COUNT;

  DROP TABLE IF EXISTS temp_valid;
  CREATE TEMPORARY TABLE temp_valid AS
  SELECT * FROM temp_prepared
  WHERE "FE" IS NOT NULL
    AND "Unité donnée d'activité" IS NOT NULL;

  DROP TABLE IF EXISTS temp_dedup;
  CREATE TEMPORARY TABLE temp_dedup AS
  SELECT DISTINCT ON (factor_key) *
  FROM temp_valid
  ORDER BY factor_key;

  INSERT INTO public.emission_factors (
    "ID_FE",
    factor_key,
    "Nom","Nom_en","Description","Description_en",
    "FE","Unité donnée d'activité","Unite_en",
    "Source","Secteur","Secteur_en",
    "Sous-secteur","Sous-secteur_en",
    "Localisation","Localisation_en",
    "Périmètre","Périmètre_en",
    "Date","Incertitude",
    "Contributeur","Contributeur_en",
    "Méthodologie","Méthodologie_en",
    "Type_de_données","Type_de_données_en",
    "Commentaires","Commentaires_en",
    import_type,
    updated_at
  )
  SELECT
    d."ID_FE",
    d.factor_key,
    d."Nom", d."Nom_en", d."Description", d."Description_en",
    d."FE", d."Unité donnée d'activité", d."Unite_en",
    d."Source", d."Secteur", d."Secteur_en",
    d."Sous-secteur", d."Sous-secteur_en",
    d."Localisation", d."Localisation_en",
    d."Périmètre", d."Périmètre_en",
    d."Date", d."Incertitude",
    d."Contributeur", d."Contributeur_en",
    d."Méthodologie", d."Méthodologie_en",
    d."Type_de_données", d."Type_de_données_en",
    d."Commentaires", d."Commentaires_en",
    'official',
    now()
  FROM temp_dedup d;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  SELECT coalesce(array_agg(DISTINCT "Source"), '{}')
  INTO v_sources
  FROM temp_dedup
  WHERE "Source" IS NOT NULL;

  IF v_sources IS NOT NULL THEN
    PERFORM public.refresh_ef_all_for_source(s) FROM unnest(v_sources) AS s;
  END IF;

  ANALYZE public.emission_factors_all_search;

  PERFORM public.run_algolia_data_task('55278ecb-f8dc-43d8-8fe6-aff7057b69d0'::uuid, 'eu');

  RETURN json_build_object(
    'inserted', v_inserted,
    'invalid', v_invalid,
    'sources', v_sources,
    'duration_ms', extract(epoch FROM (now() - v_start))*1000
  );
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
    public.safe_to_numeric(coalesce(nullif(ef."FE"::text, ''), null)) AS "FE",
    CASE WHEN trim(coalesce(ef."Date"::text,'')) ~ '^\d+$' THEN ef."Date"::integer ELSE NULL END AS "Date",
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
    public.safe_to_numeric(coalesce(nullif(ufo."FE", ''), null)) AS "FE",
    CASE WHEN trim(coalesce(ufo."Date",'')) ~ '^\d+$' THEN trim(ufo."Date")::integer ELSE NULL END AS "Date",
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
    public.safe_to_numeric(coalesce(nullif(ef."FE"::text, ''), null)) AS "FE",
    CASE WHEN trim(coalesce(ef."Date"::text,'')) ~ '^\d+$' THEN ef."Date"::integer ELSE NULL END AS "Date",
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
    public.safe_to_numeric(coalesce(nullif(ufo."FE", ''), null)) AS "FE",
    CASE WHEN trim(coalesce(ufo."Date",'')) ~ '^\d+$' THEN trim(ufo."Date")::integer ELSE NULL END AS "Date",
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

COMMIT;
