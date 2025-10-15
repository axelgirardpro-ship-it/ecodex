-- Migration: Ajouter les champs de score pour l'index Algolia
-- Date: 2025-10-15
-- Objectif: Ajouter localization_score, perimeter_score, base_score, unit_score
--           dans staging_emission_factors, emission_factors et emission_factors_all_search
--           et mettre à jour les fonctions de projection

BEGIN;

-- ============================================================================
-- 1. Ajouter les colonnes aux tables
-- ============================================================================

-- Table staging_emission_factors (type TEXT pour cohérence avec les autres colonnes)
ALTER TABLE public.staging_emission_factors
  ADD COLUMN IF NOT EXISTS localization_score text,
  ADD COLUMN IF NOT EXISTS perimeter_score text,
  ADD COLUMN IF NOT EXISTS base_score text,
  ADD COLUMN IF NOT EXISTS unit_score text;

-- Table emission_factors (type INTEGER)
ALTER TABLE public.emission_factors
  ADD COLUMN IF NOT EXISTS localization_score integer,
  ADD COLUMN IF NOT EXISTS perimeter_score integer,
  ADD COLUMN IF NOT EXISTS base_score integer,
  ADD COLUMN IF NOT EXISTS unit_score integer;

-- Table emission_factors_all_search (type INTEGER)
ALTER TABLE public.emission_factors_all_search
  ADD COLUMN IF NOT EXISTS localization_score integer,
  ADD COLUMN IF NOT EXISTS perimeter_score integer,
  ADD COLUMN IF NOT EXISTS base_score integer,
  ADD COLUMN IF NOT EXISTS unit_score integer;

-- Ajouter des commentaires explicatifs
COMMENT ON COLUMN public.staging_emission_factors.localization_score IS 'Score de localisation pour le ranking Algolia (1-10)';
COMMENT ON COLUMN public.staging_emission_factors.perimeter_score IS 'Score de périmètre pour le ranking Algolia (1-10)';
COMMENT ON COLUMN public.staging_emission_factors.base_score IS 'Score de base pour le ranking Algolia (1-10)';
COMMENT ON COLUMN public.staging_emission_factors.unit_score IS 'Score d''unité pour le ranking Algolia (1-10)';

COMMENT ON COLUMN public.emission_factors.localization_score IS 'Score de localisation pour le ranking Algolia (1-10)';
COMMENT ON COLUMN public.emission_factors.perimeter_score IS 'Score de périmètre pour le ranking Algolia (1-10)';
COMMENT ON COLUMN public.emission_factors.base_score IS 'Score de base pour le ranking Algolia (1-10)';
COMMENT ON COLUMN public.emission_factors.unit_score IS 'Score d''unité pour le ranking Algolia (1-10)';

COMMENT ON COLUMN public.emission_factors_all_search.localization_score IS 'Score de localisation pour le ranking Algolia (1-10)';
COMMENT ON COLUMN public.emission_factors_all_search.perimeter_score IS 'Score de périmètre pour le ranking Algolia (1-10)';
COMMENT ON COLUMN public.emission_factors_all_search.base_score IS 'Score de base pour le ranking Algolia (1-10)';
COMMENT ON COLUMN public.emission_factors_all_search.unit_score IS 'Score d''unité pour le ranking Algolia (1-10)';

-- Créer des index sur emission_factors_all_search pour optimiser les requêtes Algolia
CREATE INDEX IF NOT EXISTS idx_ef_all_search_localization_score 
  ON public.emission_factors_all_search(localization_score) WHERE localization_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ef_all_search_perimeter_score 
  ON public.emission_factors_all_search(perimeter_score) WHERE perimeter_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ef_all_search_base_score 
  ON public.emission_factors_all_search(base_score) WHERE base_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ef_all_search_unit_score 
  ON public.emission_factors_all_search(unit_score) WHERE unit_score IS NOT NULL;

-- ============================================================================
-- 2. Mettre à jour la fonction run_import_from_staging()
-- ============================================================================

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
  v_rebuild_start timestamptz;
  v_rebuild_ms numeric;
  v_staging_count int := 0;
  v_missing_sources text[] := '{}';
  v_error_message text;
BEGIN
  PERFORM set_config('statement_timeout','0', true);

  -- Vérifier si la table staging contient des données
  SELECT COUNT(*) INTO v_staging_count FROM public.staging_emission_factors;
  IF v_staging_count = 0 THEN
    RETURN json_build_object(
      'inserted', 0,
      'invalid', 0,
      'sources', '{}',
      'duration_ms', 0,
      'warning', 'staging vide'
    );
  END IF;

  TRUNCATE TABLE public.emission_factors;

  BEGIN
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
          -- FIX: Utiliser regexp_replace pour nettoyer TOUS les types d'espaces
          CASE 
            WHEN "FE" IS NOT NULL AND btrim("FE") != '' 
            THEN regexp_replace(btrim("FE"), '\s+', '', 'g')::numeric 
            ELSE NULL 
          END,
          -- FIX: Convertir Date proprement
          CASE 
            WHEN "Date" IS NOT NULL 
            THEN "Date"::integer 
            ELSE NULL 
          END
        ) AS factor_key,
        coalesce(nullif(btrim("Nom"), ''), nullif(btrim("Nom_en"), '')) AS "Nom",
        nullif(btrim("Nom_en"), '') AS "Nom_en",
        coalesce(nullif(btrim("Description"), ''), nullif(btrim("Description_en"), '')) AS "Description",
        nullif(btrim("Description_en"), '') AS "Description_en",
        -- FIX: Utiliser regexp_replace pour nettoyer TOUS les types d'espaces
        CASE 
          WHEN "FE" IS NOT NULL AND btrim("FE") != '' 
          THEN regexp_replace(btrim("FE"), '\s+', '', 'g')::double precision 
          ELSE NULL 
        END AS "FE",
        coalesce(nullif(btrim("Unité donnée d'activité"), ''), nullif(btrim("Unite_en"), '')) AS "Unité donnée d'activité",
        nullif(btrim("Unite_en"), '') AS "Unite_en",
        nullif(btrim("Source"), '') AS "Source",
        coalesce(nullif(btrim("Secteur"), ''), nullif(btrim("Secteur_en"), '')) AS "Secteur",
        nullif(btrim("Secteur_en"), '') AS "Secteur_en",
        coalesce(nullif(btrim("Sous-secteur"), ''), nullif(btrim("Sous-secteur_en"), '')) AS "Sous-secteur",
        nullif(btrim("Sous-secteur_en"), '') AS "Sous-secteur_en",
        coalesce(nullif(btrim("Localisation"), ''), nullif(btrim("Localisation_en"), '')) AS "Localisation",
        nullif(btrim("Localisation_en"), '') AS "Localisation_en",
        "Date"::double precision AS "Date",
        nullif(btrim("Incertitude"), '') AS "Incertitude",
        coalesce(nullif(btrim("Périmètre"), ''), nullif(btrim("Périmètre_en"), '')) AS "Périmètre",
        nullif(btrim("Périmètre_en"), '') AS "Périmètre_en",
        nullif(btrim("Contributeur"), '') AS "Contributeur",
        nullif(btrim("Contributeur_en"), '') AS "Contributeur_en",
        -- FIX: Cast en text avant btrim pour Méthodologie
        nullif(btrim("Méthodologie"::text), '') AS "Méthodologie",
        nullif(btrim("Méthodologie_en"::text), '') AS "Méthodologie_en",
        nullif(btrim("Type_de_données"), '') AS "Type_de_données",
        nullif(btrim("Type_de_données_en"), '') AS "Type_de_données_en",
        nullif(btrim("Commentaires"), '') AS "Commentaires",
        nullif(btrim("Commentaires_en"), '') AS "Commentaires_en",
        -- NOUVEAU: Conversion des scores de TEXT vers INTEGER
        CASE 
          WHEN localization_score IS NOT NULL AND btrim(localization_score) ~ '^\d+$' 
          THEN btrim(localization_score)::integer 
          ELSE NULL 
        END AS localization_score,
        CASE 
          WHEN perimeter_score IS NOT NULL AND btrim(perimeter_score) ~ '^\d+$' 
          THEN btrim(perimeter_score)::integer 
          ELSE NULL 
        END AS perimeter_score,
        CASE 
          WHEN base_score IS NOT NULL AND btrim(base_score) ~ '^\d+$' 
          THEN btrim(base_score)::integer 
          ELSE NULL 
        END AS base_score,
        CASE 
          WHEN unit_score IS NOT NULL AND btrim(unit_score) ~ '^\d+$' 
          THEN btrim(unit_score)::integer 
          ELSE NULL 
        END AS unit_score
      FROM public.staging_emission_factors;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    PERFORM public.log_import_error('Préparation', v_error_message, SQLERRM);
    RAISE EXCEPTION 'Erreur préparation: %', v_error_message;
  END;

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

  -- Auto-détecter et créer les sources manquantes
  BEGIN
    SELECT array_agg(DISTINCT s.source_name)
    INTO v_missing_sources
    FROM (SELECT DISTINCT "Source" as source_name FROM temp_dedup WHERE "Source" IS NOT NULL) s
    LEFT JOIN public.fe_sources fs ON fs.source_name = s.source_name
    WHERE fs.source_name IS NULL;

    IF v_missing_sources IS NOT NULL AND array_length(v_missing_sources, 1) > 0 THEN
      INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
      SELECT DISTINCT "Source", 'free', true, true
      FROM temp_dedup
      WHERE "Source" = ANY(v_missing_sources)
      ON CONFLICT (source_name) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_import_error('Sources', SQLERRM, NULL);
  END;

  -- Insérer les données
  BEGIN
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
      localization_score, perimeter_score, base_score, unit_score,
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
      d.localization_score, d.perimeter_score, d.base_score, d.unit_score,
      'official',
      now()
    FROM temp_dedup d;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    PERFORM public.log_import_error('Insertion', v_error_message, SQLERRM);
    RAISE EXCEPTION 'Erreur insertion: %', v_error_message;
  END;

  SELECT coalesce(array_agg(DISTINCT "Source"), '{}')
  INTO v_sources
  FROM temp_dedup
  WHERE "Source" IS NOT NULL;

  -- Rebuild complet de emission_factors_all_search
  BEGIN
    v_rebuild_start := now();
    PERFORM public.rebuild_emission_factors_all_search();
    v_rebuild_ms := extract(epoch FROM (now() - v_rebuild_start)) * 1000;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_import_error('Rebuild', SQLERRM, NULL);
    v_rebuild_ms := -1;
  END;

  -- Analyser la table
  BEGIN
    ANALYZE public.emission_factors_all_search;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_import_error('ANALYZE', SQLERRM, NULL);
  END;

  -- Appeler Algolia avec le nouveau Task ID
  BEGIN
    PERFORM public.run_algolia_data_task('55278ecb-f8dc-43d8-8fe6-aff7057b69d0'::uuid, 'eu');
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_import_error('Algolia', SQLERRM, NULL);
  END;

  RETURN json_build_object(
    'success', true,
    'inserted', v_inserted,
    'invalid', v_invalid,
    'sources', v_sources,
    'new_sources', coalesce(v_missing_sources, '{}'),
    'duration_ms', extract(epoch FROM (now() - v_start)) * 1000,
    'rebuild_ms', v_rebuild_ms,
    'all_search_count', (SELECT COUNT(*) FROM public.emission_factors_all_search),
    'user_overlays_included', (SELECT COUNT(*) FROM public.emission_factors_all_search WHERE scope = 'private')
  );

EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
  PERFORM public.log_import_error('run_import_from_staging', v_error_message, SQLERRM);
  RETURN json_build_object(
    'success', false,
    'error', v_error_message,
    'error_detail', SQLERRM,
    'duration_ms', extract(epoch FROM (now() - v_start)) * 1000
  );
END;
$$;

COMMENT ON FUNCTION public.run_import_from_staging() IS 'Import depuis staging_emission_factors - inclut les scores Algolia (localization_score, perimeter_score, base_score, unit_score) - Task ID Algolia: 55278ecb-f8dc-43d8-8fe6-aff7057b69d0';

-- ============================================================================
-- 3. Mettre à jour la fonction rebuild_emission_factors_all_search()
-- ============================================================================

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
    "ID_FE",
    localization_score, perimeter_score, base_score, unit_score
  )
  SELECT
    ef."ID_FE" AS object_id,
    'public' AS scope,
    NULL AS workspace_id,
    COALESCE(fs.access_level, 'free') AS access_level,
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
    ef."FE"::numeric        AS "FE",
    ef."Date"::integer      AS "Date",
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
    ef."ID_FE"              AS "ID_FE",
    ef.localization_score::integer AS localization_score,
    ef.perimeter_score::integer AS perimeter_score,
    ef.base_score::integer AS base_score,
    ef.unit_score::integer AS unit_score
  FROM public.emission_factors ef
  LEFT JOIN public.fe_sources fs ON fs.source_name = ef."Source";

  -- Insertion depuis user_factor_overlays (colonnes en text, conversion sécurisée nécessaire)
  INSERT INTO public.emission_factors_all_search (
    object_id, scope, workspace_id, access_level, assigned_workspace_ids,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "FE","Date","Incertitude","Source","is_blurred","variant",
    "Contributeur","Méthodologie","Type_de_données",
    "Contributeur_en","Méthodologie_en","Type_de_données_en",
    "ID_FE",
    localization_score, perimeter_score, base_score, unit_score
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
    NULL                     AS "ID_FE",
    NULL AS localization_score,
    NULL AS perimeter_score,
    NULL AS base_score,
    NULL AS unit_score
  FROM public.user_factor_overlays ufo
  LEFT JOIN public.fe_sources fs ON fs.source_name = ufo."Source";

  ANALYZE public.emission_factors_all_search;
END;
$$;

COMMENT ON FUNCTION public.rebuild_emission_factors_all_search() IS 'Rebuild complet de emission_factors_all_search - inclut les scores Algolia';

-- ============================================================================
-- 4. Mettre à jour la fonction refresh_ef_all_for_source()
-- ============================================================================

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

  -- Insertion depuis emission_factors
  INSERT INTO public.emission_factors_all_search (
    object_id, scope, workspace_id, access_level, assigned_workspace_ids,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "FE","Date","Incertitude","Source","is_blurred","variant",
    "Contributeur","Méthodologie","Type_de_données",
    "Contributeur_en","Méthodologie_en","Type_de_données_en",
    "ID_FE",
    localization_score, perimeter_score, base_score, unit_score
  )
  SELECT
    ef."ID_FE" AS object_id,
    'public' AS scope,
    NULL AS workspace_id,
    COALESCE(fs.access_level, 'free') AS access_level,
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
    ef."FE"::numeric        AS "FE",
    ef."Date"::integer      AS "Date",
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
    ef."ID_FE"              AS "ID_FE",
    ef.localization_score::integer AS localization_score,
    ef.perimeter_score::integer AS perimeter_score,
    ef.base_score::integer AS base_score,
    ef.unit_score::integer AS unit_score
  FROM public.emission_factors ef
  LEFT JOIN public.fe_sources fs ON fs.source_name = ef."Source"
  WHERE ef."Source" = p_source;

  -- Insertion depuis user_factor_overlays
  INSERT INTO public.emission_factors_all_search (
    object_id, scope, workspace_id, access_level, assigned_workspace_ids,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "FE","Date","Incertitude","Source","is_blurred","variant",
    "Contributeur","Méthodologie","Type_de_données",
    "Contributeur_en","Méthodologie_en","Type_de_données_en",
    "ID_FE",
    localization_score, perimeter_score, base_score, unit_score
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
    NULL                     AS "ID_FE",
    NULL AS localization_score,
    NULL AS perimeter_score,
    NULL AS base_score,
    NULL AS unit_score
  FROM public.user_factor_overlays ufo
  LEFT JOIN public.fe_sources fs ON fs.source_name = ufo."Source"
  WHERE ufo."Source" = p_source;

  ANALYZE public.emission_factors_all_search;
END;
$$;

COMMENT ON FUNCTION public.refresh_ef_all_for_source(text) IS 'Rafraîchit emission_factors_all_search pour une source - inclut les scores Algolia';

COMMIT;

