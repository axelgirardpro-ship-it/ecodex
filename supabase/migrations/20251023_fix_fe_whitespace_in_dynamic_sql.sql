-- Migration: Fix whitespace removal in FE column for dynamic SQL
-- Date: 2025-10-23
-- Issue: Le regexp_replace dans EXECUTE nécessite un échappement correct des backslashes
--        Les valeurs comme "2 051" avec U+202F (espace fine insécable) causent des erreurs
-- Solution: Corriger l'échappement de la regex dans le SQL dynamique

CREATE OR REPLACE FUNCTION public.run_import_from_staging()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout TO '0'
AS $function$
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

  -- Vider la table principale (mode replace)
  TRUNCATE TABLE public.emission_factors;

  -- Préparation des données
  BEGIN
    DROP TABLE IF EXISTS temp_prepared;
    -- ✅ FIX: Utiliser une vraie table temporaire sans EXECUTE pour éviter les problèmes d'échappement
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
          -- ✅ FIX: Nettoyer TOUS les types d'espaces (y compris U+202F)
          CASE 
            WHEN "FE" IS NOT NULL AND btrim("FE") != '' 
            THEN regexp_replace(btrim("FE"), '\s+', '', 'g')::numeric 
            ELSE NULL 
          END,
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
        -- ✅ FIX: Nettoyer TOUS les types d'espaces (y compris U+202F)
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
        nullif(btrim("Méthodologie"::text), '') AS "Méthodologie",
        nullif(btrim("Méthodologie_en"::text), '') AS "Méthodologie_en",
        nullif(btrim("Type_de_données"), '') AS "Type_de_données",
        nullif(btrim("Type_de_données_en"), '') AS "Type_de_données_en",
        nullif(btrim("Commentaires"), '') AS "Commentaires",
        nullif(btrim("Commentaires_en"), '') AS "Commentaires_en",
        localization_score::integer AS localization_score,
        perimeter_score::integer AS perimeter_score,
        base_score::integer AS base_score,
        unit_score::integer AS unit_score
      FROM public.staging_emission_factors;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    PERFORM public.log_import_error('Préparation', v_error_message, SQLERRM);
    RAISE EXCEPTION 'Erreur préparation: %', v_error_message;
  END;

  -- Séparer les lignes invalides
  DROP TABLE IF EXISTS temp_invalid;
  CREATE TEMPORARY TABLE temp_invalid AS
  SELECT * FROM temp_prepared
  WHERE "FE" IS NULL
     OR "Unité donnée d'activité" IS NULL;
  GET DIAGNOSTICS v_invalid = ROW_COUNT;

  -- Garder seulement les lignes valides
  DROP TABLE IF EXISTS temp_valid;
  CREATE TEMPORARY TABLE temp_valid AS
  SELECT * FROM temp_prepared
  WHERE "FE" IS NOT NULL
    AND "Unité donnée d'activité" IS NOT NULL;

  -- Déduplication par factor_key
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

  -- Insérer les données dans emission_factors
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

  -- Collecter les sources importées
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

  -- Appeler Algolia
  BEGIN
    PERFORM public.run_algolia_data_task('914124fb-141d-4239-aeea-784bc5b24f41'::uuid, 'eu');
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
$function$;

COMMENT ON FUNCTION public.run_import_from_staging() IS 
'Import depuis staging_emission_factors - Fix: utilise CREATE TEMPORARY TABLE au lieu de EXECUTE pour éviter les problèmes d''échappement de regex avec les espaces Unicode (U+202F, etc.)';

