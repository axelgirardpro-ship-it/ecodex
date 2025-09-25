-- Ajoute les métadonnées Contributeur/Méthodologie/Type_de_données (FR/EN)
-- et ré-aligne les projections/admin & imports utilisateurs
BEGIN;

-- 1) Schéma principal (admin + overlays)
ALTER TABLE public.emission_factors
  ADD COLUMN IF NOT EXISTS "Contributeur_en" text,
  ADD COLUMN IF NOT EXISTS "Méthodologie" text,
  ADD COLUMN IF NOT EXISTS "Méthodologie_en" text,
  ADD COLUMN IF NOT EXISTS "Type_de_données" text,
  ADD COLUMN IF NOT EXISTS "Type_de_données_en" text;

ALTER TABLE public.staging_emission_factors
  ADD COLUMN IF NOT EXISTS "Contributeur_en" text,
  ADD COLUMN IF NOT EXISTS "Méthodologie" text,
  ADD COLUMN IF NOT EXISTS "Méthodologie_en" text,
  ADD COLUMN IF NOT EXISTS "Type_de_données" text,
  ADD COLUMN IF NOT EXISTS "Type_de_données_en" text;

ALTER TABLE public.user_factor_overlays
  ADD COLUMN IF NOT EXISTS "Contributeur_en" text,
  ADD COLUMN IF NOT EXISTS "Méthodologie" text,
  ADD COLUMN IF NOT EXISTS "Méthodologie_en" text,
  ADD COLUMN IF NOT EXISTS "Type_de_données" text,
  ADD COLUMN IF NOT EXISTS "Type_de_données_en" text;

-- 2) Tables staging/import utilisateur
ALTER TABLE public.staging_user_imports
  ADD COLUMN IF NOT EXISTS "Contributeur_en" text,
  ADD COLUMN IF NOT EXISTS "Méthodologie" text,
  ADD COLUMN IF NOT EXISTS "Méthodologie_en" text,
  ADD COLUMN IF NOT EXISTS "Type_de_données" text,
  ADD COLUMN IF NOT EXISTS "Type_de_données_en" text;

ALTER TABLE public.user_batch_algolia
  ADD COLUMN IF NOT EXISTS "Contributeur" text,
  ADD COLUMN IF NOT EXISTS "Contributeur_en" text,
  ADD COLUMN IF NOT EXISTS "Méthodologie" text,
  ADD COLUMN IF NOT EXISTS "Méthodologie_en" text,
  ADD COLUMN IF NOT EXISTS "Type_de_données" text,
  ADD COLUMN IF NOT EXISTS "Type_de_données_en" text;

-- 3) Projection Algolia commune (admin + overlays)
ALTER TABLE public.emission_factors_all_search
  ADD COLUMN IF NOT EXISTS "Contributeur" text,
  ADD COLUMN IF NOT EXISTS "Méthodologie" text,
  ADD COLUMN IF NOT EXISTS "Type_de_données" text,
  ADD COLUMN IF NOT EXISTS "Contributeur_en" text,
  ADD COLUMN IF NOT EXISTS "Méthodologie_en" text,
  ADD COLUMN IF NOT EXISTS "Type_de_données_en" text;

CREATE OR REPLACE FUNCTION public.rebuild_emission_factors_all_search()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('statement_timeout', '0', true);

  TRUNCATE TABLE public.emission_factors_all_search;

  -- Base commune admin
  INSERT INTO public.emission_factors_all_search (
    object_id, scope, workspace_id, access_level, assigned_workspace_ids, languages,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "Contributeur","Méthodologie","Type_de_données",
    "Contributeur_en","Méthodologie_en","Type_de_données_en",
    "FE","Date","Incertitude","Source"
  )
  SELECT
    ef.id::uuid AS object_id,
    CASE WHEN ef.workspace_id ~ '^[0-9a-fA-F-]{36}$' THEN 'private' ELSE 'public' END AS scope,
    CASE WHEN ef.workspace_id ~ '^[0-9a-fA-F-]{36}$' THEN ef.workspace_id::uuid ELSE NULL END AS workspace_id,
    fs.access_level,
    (
      SELECT array_agg(ws.workspace_id)
      FROM public.fe_source_workspace_assignments ws
      WHERE ws.source_name = ef."Source"
    ) AS assigned_workspace_ids,
    array_remove(array[
      CASE WHEN (ef."Nom" IS NOT NULL OR ef."Description" IS NOT NULL OR ef."Unité donnée d'activité" IS NOT NULL OR ef."Secteur" IS NOT NULL OR ef."Localisation" IS NOT NULL OR ef."Méthodologie" IS NOT NULL OR ef."Type_de_données" IS NOT NULL) THEN 'fr' END,
      CASE WHEN (ef."Nom_en" IS NOT NULL OR ef."Description_en" IS NOT NULL OR ef."Unite_en" IS NOT NULL OR ef."Secteur_en" IS NOT NULL OR ef."Localisation_en" IS NOT NULL OR ef."Méthodologie_en" IS NOT NULL OR ef."Type_de_données_en" IS NOT NULL) THEN 'en' END
    ], NULL)::text[] AS languages,
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
    ef."Contributeur"       AS "Contributeur",
    ef."Méthodologie"       AS "Méthodologie",
    ef."Type_de_données"    AS "Type_de_données",
    ef."Contributeur_en"    AS "Contributeur_en",
    ef."Méthodologie_en"    AS "Méthodologie_en",
    ef."Type_de_données_en" AS "Type_de_données_en",
    public.safe_to_numeric(coalesce(nullif(ef."FE"::text, ''), null)) AS "FE",
    CASE WHEN trim(coalesce(ef."Date"::text,'')) ~ '^\d+$' THEN ef."Date"::integer ELSE NULL END AS "Date",
    ef."Incertitude"        AS "Incertitude",
    ef."Source"             AS "Source"
  FROM public.emission_factors ef
  JOIN public.fe_sources fs ON fs.source_name = ef."Source"
  WHERE ef.is_latest = true;

  -- Overlays utilisateurs
  INSERT INTO public.emission_factors_all_search (
    object_id, scope, workspace_id, access_level, assigned_workspace_ids, languages,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "Contributeur","Méthodologie","Type_de_données",
    "Contributeur_en","Méthodologie_en","Type_de_données_en",
    "FE","Date","Incertitude","Source"
  )
  SELECT
    ufo.overlay_id AS object_id,
    'private'      AS scope,
    ufo.workspace_id,
    COALESCE(fs.access_level, 'standard') AS access_level,
    (
      SELECT array_agg(ws.workspace_id)
      FROM public.fe_source_workspace_assignments ws
      WHERE ws.source_name = ufo."Source"
    ) AS assigned_workspace_ids,
    array_remove(array[
      CASE WHEN (ufo."Nom" IS NOT NULL OR ufo."Description" IS NOT NULL OR ufo."Unité donnée d'activité" IS NOT NULL OR ufo."Secteur" IS NOT NULL OR ufo."Localisation" IS NOT NULL OR ufo."Méthodologie" IS NOT NULL OR ufo."Type_de_données" IS NOT NULL) THEN 'fr' END,
      CASE WHEN (ufo."Nom_en" IS NOT NULL OR ufo."Description_en" IS NOT NULL OR ufo."Unite_en" IS NOT NULL OR ufo."Secteur_en" IS NOT NULL OR ufo."Localisation_en" IS NOT NULL OR ufo."Méthodologie_en" IS NOT NULL OR ufo."Type_de_données_en" IS NOT NULL) THEN 'en' END
    ], NULL)::text[] AS languages,
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
    ufo."Contributeur"       AS "Contributeur",
    ufo."Méthodologie"       AS "Méthodologie",
    ufo."Type_de_données"    AS "Type_de_données",
    ufo."Contributeur_en"    AS "Contributeur_en",
    ufo."Méthodologie_en"    AS "Méthodologie_en",
    ufo."Type_de_données_en" AS "Type_de_données_en",
    public.safe_to_numeric(coalesce(nullif(ufo."FE", ''), null)) AS "FE",
    CASE WHEN trim(coalesce(ufo."Date",'')) ~ '^\d+$' THEN trim(ufo."Date")::integer ELSE NULL END AS "Date",
    ufo."Incertitude"        AS "Incertitude",
    ufo."Source"             AS "Source"
  FROM public.user_factor_overlays ufo
  LEFT JOIN public.fe_sources fs ON fs.source_name = ufo."Source";

  RAISE NOTICE 'emission_factors_all_search rebuilt: % rows', (SELECT count(*) FROM public.emission_factors_all_search);
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
    RAISE EXCEPTION 'refresh_ef_all_for_source: source vide';
  END IF;

  PERFORM set_config('statement_timeout', '0', true);

  DELETE FROM public.emission_factors_all_search WHERE "Source" = p_source;

  INSERT INTO public.emission_factors_all_search (
    object_id, scope, workspace_id, access_level, assigned_workspace_ids, languages,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "Contributeur","Méthodologie","Type_de_données",
    "Contributeur_en","Méthodologie_en","Type_de_données_en",
    "FE","Date","Incertitude","Source"
  )
  SELECT
    ef.id::uuid AS object_id,
    CASE WHEN ef.workspace_id ~ '^[0-9a-fA-F-]{36}$' THEN 'private' ELSE 'public' END AS scope,
    CASE WHEN ef.workspace_id ~ '^[0-9a-fA-F-]{36}$' THEN ef.workspace_id::uuid ELSE NULL END AS workspace_id,
    fs.access_level,
    (
      SELECT array_agg(ws.workspace_id)
      FROM public.fe_source_workspace_assignments ws
      WHERE ws.source_name = ef."Source"
    ) AS assigned_workspace_ids,
    array_remove(array[
      CASE WHEN (ef."Nom" IS NOT NULL OR ef."Description" IS NOT NULL OR ef."Unité donnée d'activité" IS NOT NULL OR ef."Secteur" IS NOT NULL OR ef."Localisation" IS NOT NULL OR ef."Méthodologie" IS NOT NULL OR ef."Type_de_données" IS NOT NULL) THEN 'fr' END,
      CASE WHEN (ef."Nom_en" IS NOT NULL OR ef."Description_en" IS NOT NULL OR ef."Unite_en" IS NOT NULL OR ef."Secteur_en" IS NOT NULL OR ef."Localisation_en" IS NOT NULL OR ef."Méthodologie_en" IS NOT NULL OR ef."Type_de_données_en" IS NOT NULL) THEN 'en' END
    ], NULL)::text[] AS languages,
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
    ef."Contributeur"       AS "Contributeur",
    ef."Méthodologie"       AS "Méthodologie",
    ef."Type_de_données"    AS "Type_de_données",
    ef."Contributeur_en"    AS "Contributeur_en",
    ef."Méthodologie_en"    AS "Méthodologie_en",
    ef."Type_de_données_en" AS "Type_de_données_en",
    public.safe_to_numeric(coalesce(nullif(ef."FE"::text, ''), null)) AS "FE",
    CASE WHEN trim(coalesce(ef."Date"::text,'')) ~ '^\d+$' THEN ef."Date"::integer ELSE NULL END AS "Date",
    ef."Incertitude"        AS "Incertitude",
    ef."Source"             AS "Source"
  FROM public.emission_factors ef
  JOIN public.fe_sources fs ON fs.source_name = ef."Source"
  WHERE ef.is_latest = true AND ef."Source" = p_source;

  INSERT INTO public.emission_factors_all_search (
    object_id, scope, workspace_id, access_level, assigned_workspace_ids, languages,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "Contributeur","Méthodologie","Type_de_données",
    "Contributeur_en","Méthodologie_en","Type_de_données_en",
    "FE","Date","Incertitude","Source"
  )
  SELECT
    ufo.overlay_id AS object_id,
    'private'      AS scope,
    ufo.workspace_id,
    COALESCE(fs.access_level, 'standard') AS access_level,
    (
      SELECT array_agg(ws.workspace_id)
      FROM public.fe_source_workspace_assignments ws
      WHERE ws.source_name = ufo."Source"
    ) AS assigned_workspace_ids,
    array_remove(array[
      CASE WHEN (ufo."Nom" IS NOT NULL OR ufo."Description" IS NOT NULL OR ufo."Unité donnée d'activité" IS NOT NULL OR ufo."Secteur" IS NOT NULL OR ufo."Localisation" IS NOT NULL OR ufo."Méthodologie" IS NOT NULL OR ufo."Type_de_données" IS NOT NULL) THEN 'fr' END,
      CASE WHEN (ufo."Nom_en" IS NOT NULL OR ufo."Description_en" IS NOT NULL OR ufo."Unite_en" IS NOT NULL OR ufo."Secteur_en" IS NOT NULL OR ufo."Localisation_en" IS NOT NULL OR ufo."Méthodologie_en" IS NOT NULL OR ufo."Type_de_données_en" IS NOT NULL) THEN 'en' END
    ], NULL)::text[] AS languages,
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
    ufo."Contributeur"       AS "Contributeur",
    ufo."Méthodologie"       AS "Méthodologie",
    ufo."Type_de_données"    AS "Type_de_données",
    ufo."Contributeur_en"    AS "Contributeur_en",
    ufo."Méthodologie_en"    AS "Méthodologie_en",
    ufo."Type_de_données_en" AS "Type_de_données_en",
    public.safe_to_numeric(coalesce(nullif(ufo."FE", ''), null)) AS "FE",
    CASE WHEN trim(coalesce(ufo."Date",'')) ~ '^\d+$' THEN trim(ufo."Date")::integer ELSE NULL END AS "Date",
    ufo."Incertitude"        AS "Incertitude",
    ufo."Source"             AS "Source"
  FROM public.user_factor_overlays ufo
  LEFT JOIN public.fe_sources fs ON fs.source_name = ufo."Source"
  WHERE ufo."Source" = p_source;

  RAISE NOTICE 'emission_factors_all_search refreshed for source: %', p_source;
END;
$$;

-- 4) Pipeline admin (Dataiku -> staging -> run_import_from_staging)
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
  s text;
BEGIN
  PERFORM set_config('statement_timeout','0', true);

  DROP TABLE IF EXISTS temp_prepared;
  CREATE TEMPORARY TABLE temp_prepared AS
    SELECT
      public.calculate_factor_key(
        p_nom          => coalesce(nullif(btrim("Nom"), ''), nullif(btrim("Nom_en"), '')),
        p_unite        => coalesce(nullif(btrim("Unité donnée d'activité"), ''), nullif(btrim("Unite_en"), '')),
        p_source       => nullif(btrim("Source"), ''),
        p_perimetre    => coalesce(nullif(btrim("Périmètre"), ''), nullif(btrim("Périmètre_en"), '')),
        p_localisation => coalesce(nullif(btrim("Localisation"), ''), nullif(btrim("Localisation_en"), '')),
        p_workspace_id => null,
        p_language     => NULL,
        p_fe           => public.safe_to_numeric(nullif(btrim("FE"), '')),
        p_date         => public.safe_to_int(nullif(btrim("Date"), ''))
      ) AS factor_key,
      coalesce(nullif(btrim("Nom"), ''), nullif(btrim("Nom_en"), ''))             AS "Nom",
      nullif(btrim("Nom_en"), '')                                                   AS "Nom_en",
      coalesce(nullif(btrim("Description"), ''), nullif(btrim("Description_en"), '')) AS "Description",
      nullif(btrim("Description_en"), '')                                           AS "Description_en",
      public.safe_to_numeric(nullif(btrim("FE"), ''))::double precision             AS "FE",
      coalesce(nullif(btrim("Unité donnée d'activité"), ''), nullif(btrim("Unite_en"), '')) AS "Unité donnée d'activité",
      nullif(btrim("Unite_en"), '')                                                 AS "Unite_en",
      nullif(btrim("Source"), '')                                                   AS "Source",
      coalesce(nullif(btrim("Secteur"), ''), nullif(btrim("Secteur_en"), ''))      AS "Secteur",
      nullif(btrim("Secteur_en"), '')                                               AS "Secteur_en",
      coalesce(nullif(btrim("Sous-secteur"), ''), nullif(btrim("Sous-secteur_en"), '')) AS "Sous-secteur",
      nullif(btrim("Sous-secteur_en"), '')                                          AS "Sous-secteur_en",
      coalesce(nullif(btrim("Localisation"), ''), nullif(btrim("Localisation_en"), '')) AS "Localisation",
      nullif(btrim("Localisation_en"), '')                                          AS "Localisation_en",
      public.safe_to_int(nullif(btrim("Date"), ''))::double precision               AS "Date",
      nullif(btrim("Incertitude"), '')                                              AS "Incertitude",
      coalesce(nullif(btrim("Périmètre"), ''), nullif(btrim("Périmètre_en"), '')) AS "Périmètre",
      nullif(btrim("Périmètre_en"), '')                                             AS "Périmètre_en",
      nullif(btrim("Contributeur"), '')                                             AS "Contributeur",
      nullif(btrim("Contributeur_en"), '')                                          AS "Contributeur_en",
      nullif(btrim("Méthodologie"), '')                                             AS "Méthodologie",
      nullif(btrim("Méthodologie_en"), '')                                          AS "Méthodologie_en",
      nullif(btrim("Type_de_données"), '')                                          AS "Type_de_données",
      nullif(btrim("Type_de_données_en"), '')                                       AS "Type_de_données_en",
      nullif(btrim("Commentaires"), '')                                            AS "Commentaires",
      nullif(btrim("Commentaires_en"), '')                                         AS "Commentaires_en"
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

  INSERT INTO public.fe_sources (source_name, access_level, is_global)
  SELECT DISTINCT "Source", 'standard', true FROM temp_dedup WHERE "Source" IS NOT NULL
  ON CONFLICT (source_name) DO NOTHING;

  INSERT INTO public.fe_source_workspace_assignments (source_name, workspace_id, assigned_by)
  SELECT fs.source_name, w.id, NULL
  FROM public.fe_sources fs
  JOIN public.workspaces w ON true
  WHERE fs.access_level = 'standard'
  ON CONFLICT DO NOTHING;

  INSERT INTO public.emission_factors (
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
    is_latest,
    updated_at
  )
  SELECT 
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
    true,
    now()
  FROM temp_dedup d
  ON CONFLICT (factor_key) DO UPDATE SET
    "Nom" = excluded."Nom",
    "Nom_en" = excluded."Nom_en",
    "Description" = excluded."Description",
    "Description_en" = excluded."Description_en",
    "FE" = excluded."FE",
    "Unité donnée d'activité" = excluded."Unité donnée d'activité",
    "Unite_en" = excluded."Unite_en",
    "Source" = excluded."Source",
    "Secteur" = excluded."Secteur",
    "Secteur_en" = excluded."Secteur_en",
    "Sous-secteur" = excluded."Sous-secteur",
    "Sous-secteur_en" = excluded."Sous-secteur_en",
    "Localisation" = excluded."Localisation",
    "Localisation_en" = excluded."Localisation_en",
    "Périmètre" = excluded."Périmètre",
    "Périmètre_en" = excluded."Périmètre_en",
    "Date" = excluded."Date",
    "Incertitude" = excluded."Incertitude",
    "Contributeur" = excluded."Contributeur",
    "Contributeur_en" = excluded."Contributeur_en",
    "Méthodologie" = excluded."Méthodologie",
    "Méthodologie_en" = excluded."Méthodologie_en",
    "Type_de_données" = excluded."Type_de_données",
    "Type_de_données_en" = excluded."Type_de_données_en",
    "Commentaires" = excluded."Commentaires",
    "Commentaires_en" = excluded."Commentaires_en",
    is_latest = true,
    updated_at = now();
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  SELECT coalesce(array_agg(distinct "Source"), '{}') INTO v_sources FROM temp_dedup WHERE "Source" IS NOT NULL;
  IF v_sources IS NOT NULL THEN
    FOREACH s IN ARRAY v_sources LOOP
      PERFORM public.refresh_ef_all_for_source(s);
    END LOOP;
  END IF;

  ANALYZE public.emission_factors_all_search;

  RETURN json_build_object(
    'inserted_or_updated', v_inserted,
    'invalid', v_invalid,
    'sources', v_sources,
    'duration_ms', extract(epoch FROM (now() - v_start)) * 1000
  );
END;
$$;

-- 5) Projection utilisateur -> Algolia
CREATE OR REPLACE FUNCTION public.prepare_user_batch_projection(
  p_workspace_id uuid,
  p_dataset_name text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  IF p_workspace_id IS NULL OR coalesce(trim(p_dataset_name),'') = '' THEN
    RAISE EXCEPTION 'workspace_id et dataset_name requis';
  END IF;

  TRUNCATE TABLE public.user_batch_algolia;

  INSERT INTO public.user_batch_algolia (
    workspace_id, dataset_name, scope, access_level, languages,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "Contributeur","Contributeur_en",
    "Méthodologie","Méthodologie_en",
    "Type_de_données","Type_de_données_en",
    "FE","Date","Incertitude","Source"
  )
  SELECT
    sui.workspace_id,
    sui.dataset_name,
    'private' AS scope,
    COALESCE(fs.access_level, 'standard') AS access_level,
    array_remove(array[
      CASE WHEN (sui."Nom" IS NOT NULL OR sui."Description" IS NOT NULL OR sui."Unité donnée d'activité" IS NOT NULL OR sui."Secteur" IS NOT NULL OR sui."Localisation" IS NOT NULL OR sui."Méthodologie" IS NOT NULL OR sui."Type_de_données" IS NOT NULL) THEN 'fr' END,
      CASE WHEN (sui."Nom_en" IS NOT NULL OR sui."Description_en" IS NOT NULL OR sui."Unite_en" IS NOT NULL OR sui."Secteur_en" IS NOT NULL OR sui."Localisation_en" IS NOT NULL OR sui."Méthodologie_en" IS NOT NULL OR sui."Type_de_données_en" IS NOT NULL) THEN 'en' END
    ], NULL)::text[] AS languages,
    sui."Nom" AS "Nom_fr",
    sui."Description" AS "Description_fr",
    sui."Commentaires" AS "Commentaires_fr",
    sui."Secteur" AS "Secteur_fr",
    sui."Sous-secteur" AS "Sous-secteur_fr",
    sui."Périmètre" AS "Périmètre_fr",
    sui."Localisation" AS "Localisation_fr",
    sui."Unité donnée d'activité" AS "Unite_fr",
    sui."Nom_en",
    sui."Description_en",
    sui."Commentaires_en",
    sui."Secteur_en",
    sui."Sous-secteur_en",
    sui."Périmètre_en",
    sui."Localisation_en",
    sui."Unite_en",
    sui."Contributeur",
    sui."Contributeur_en",
    sui."Méthodologie",
    sui."Méthodologie_en",
    sui."Type_de_données",
    sui."Type_de_données_en",
    public.safe_to_numeric(nullif(sui."FE",'')) AS "FE",
    CASE WHEN trim(coalesce(sui."Date",'')) ~ '^\d+$' THEN trim(sui."Date")::int ELSE NULL END AS "Date",
    sui."Incertitude",
    sui."Source"
  FROM public.staging_user_imports sui
  LEFT JOIN public.fe_sources fs ON fs.source_name = sui.dataset_name
  WHERE sui.workspace_id = p_workspace_id AND sui.dataset_name = p_dataset_name;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.batch_upsert_user_factor_overlays(
  p_workspace_id uuid,
  p_dataset_name text,
  p_records jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
  v_updated int := 0;
BEGIN
  IF p_records IS NULL OR jsonb_typeof(p_records) <> 'array' THEN
    RAISE EXCEPTION 'p_records doit être un tableau JSON';
  END IF;

  WITH incoming AS (
    SELECT
      p_workspace_id AS workspace_id,
      p_dataset_name AS dataset_name,
      (rec->>'Nom') AS "Nom",
      (rec->>'Nom_en') AS "Nom_en",
      (rec->>'Description') AS "Description",
      (rec->>'Description_en') AS "Description_en",
      (rec->>'FE') AS "FE",
      (rec->>'Unité donnée d''activité') AS "Unité donnée d'activité",
      (rec->>'Unite_en') AS "Unite_en",
      (rec->>'Source') AS "Source",
      (rec->>'Secteur') AS "Secteur",
      (rec->>'Secteur_en') AS "Secteur_en",
      (rec->>'Sous-secteur') AS "Sous-secteur",
      (rec->>'Sous-secteur_en') AS "Sous-secteur_en",
      (rec->>'Localisation') AS "Localisation",
      (rec->>'Localisation_en') AS "Localisation_en",
      (rec->>'Date') AS "Date",
      (rec->>'Incertitude') AS "Incertitude",
      (rec->>'Périmètre') AS "Périmètre",
      (rec->>'Périmètre_en') AS "Périmètre_en",
      (rec->>'Contributeur') AS "Contributeur",
      (rec->>'Contributeur_en') AS "Contributeur_en",
      (rec->>'Méthodologie') AS "Méthodologie",
      (rec->>'Méthodologie_en') AS "Méthodologie_en",
      (rec->>'Type_de_données') AS "Type_de_données",
      (rec->>'Type_de_données_en') AS "Type_de_données_en",
      (rec->>'Commentaires') AS "Commentaires",
      (rec->>'Commentaires_en') AS "Commentaires_en"
    FROM jsonb_array_elements(p_records) AS rec
  ), prepared AS (
    SELECT
      workspace_id,
      dataset_name,
      public.safe_to_numeric(nullif("FE", '')) AS fe_num,
      CASE WHEN trim(coalesce("Date",'')) ~ '^\d+$' THEN trim("Date")::int ELSE NULL END AS date_int,
      coalesce(nullif("Nom", ''), nullif("Nom_en", '')) AS nom,
      coalesce(nullif("Unité donnée d'activité", ''), null) AS unite,
      coalesce(nullif("Source", ''), null) AS source,
      coalesce(nullif("Périmètre", ''), nullif("Périmètre_en", '')) AS perimetre,
      coalesce(nullif("Localisation", ''), nullif("Localisation_en", '')) AS localisation,
      incoming.*
    FROM incoming
  ), keyed AS (
    SELECT *, public.calculate_factor_key(
      p_nom := nom,
      p_unite := unite,
      p_source := source,
      p_perimetre := perimetre,
      p_localisation := localisation,
      p_workspace_id := NULL,
      p_language := NULL,
      p_fe := fe_num,
      p_date := date_int
    ) AS factor_key
    FROM prepared
  ), upsert AS (
    INSERT INTO public.user_factor_overlays AS ufo (
      workspace_id, dataset_name, factor_key,
      "Nom","Nom_en","Description","Description_en","FE","Unité donnée d'activité","Unite_en","Source",
      "Secteur","Secteur_en","Sous-secteur","Sous-secteur_en","Localisation","Localisation_en","Date","Incertitude",
      "Périmètre","Périmètre_en",
      "Contributeur","Contributeur_en",
      "Méthodologie","Méthodologie_en",
      "Type_de_données","Type_de_données_en",
      "Commentaires","Commentaires_en",
      updated_at
    )
    SELECT
      workspace_id, dataset_name, factor_key,
      "Nom","Nom_en","Description","Description_en","FE","Unité donnée d'activité","Unite_en","Source",
      "Secteur","Secteur_en","Sous-secteur","Sous-secteur_en","Localisation","Localisation_en","Date","Incertitude",
      "Périmètre","Périmètre_en",
      "Contributeur","Contributeur_en",
      "Méthodologie","Méthodologie_en",
      "Type_de_données","Type_de_données_en",
      "Commentaires","Commentaires_en",
      now()
    FROM keyed
    WHERE factor_key IS NOT NULL
    ON CONFLICT (workspace_id, factor_key) DO UPDATE
      SET dataset_name = excluded.dataset_name,
          "Nom" = excluded."Nom",
          "Nom_en" = excluded."Nom_en",
          "Description" = excluded."Description",
          "Description_en" = excluded."Description_en",
          "FE" = excluded."FE",
          "Unité donnée d'activité" = excluded."Unité donnée d'activité",
          "Unite_en" = excluded."Unite_en",
          "Source" = excluded."Source",
          "Secteur" = excluded."Secteur",
          "Secteur_en" = excluded."Secteur_en",
          "Sous-secteur" = excluded."Sous-secteur",
          "Sous-secteur_en" = excluded."Sous-secteur_en",
          "Localisation" = excluded."Localisation",
          "Localisation_en" = excluded."Localisation_en",
          "Date" = excluded."Date",
          "Incertitude" = excluded."Incertitude",
          "Périmètre" = excluded."Périmètre",
          "Périmètre_en" = excluded."Périmètre_en",
          "Contributeur" = excluded."Contributeur",
          "Contributeur_en" = excluded."Contributeur_en",
          "Méthodologie" = excluded."Méthodologie",
          "Méthodologie_en" = excluded."Méthodologie_en",
          "Type_de_données" = excluded."Type_de_données",
          "Type_de_données_en" = excluded."Type_de_données_en",
          "Commentaires" = excluded."Commentaires",
          "Commentaires_en" = excluded."Commentaires_en",
          updated_at = now()
    RETURNING (xmax = 0) AS inserted
  )
  SELECT
    COUNT(*) FILTER (WHERE inserted),
    COUNT(*) FILTER (WHERE NOT inserted)
  INTO v_inserted, v_updated
  FROM upsert;

  RETURN jsonb_build_object('inserted', v_inserted, 'updated', v_updated);
END;
$$;

COMMIT;

