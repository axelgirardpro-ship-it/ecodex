-- Migration: Add robust error handling to import flow
-- Date: 2025-10-13
-- Issue: Improve robustness with better error handling and validation
-- Solution: Add try-catch blocks, validation checks, and detailed logging

-- Fonction utilitaire pour logger les erreurs d'import
CREATE OR REPLACE FUNCTION public.log_import_error(
  p_context text,
  p_error_message text,
  p_error_detail text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE WARNING '[IMPORT ERROR] Context: %, Message: %, Detail: %', 
    p_context, p_error_message, coalesce(p_error_detail, 'N/A');
END;
$$;

-- Amélioration de run_import_from_staging avec gestion d'erreurs robuste
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
  -- Configuration timeout
  PERFORM set_config('statement_timeout','0', true);

  -- Validation: vérifier que staging_emission_factors n'est pas vide
  SELECT COUNT(*) INTO v_staging_count FROM public.staging_emission_factors;
  
  IF v_staging_count = 0 THEN
    RAISE WARNING 'staging_emission_factors est vide, aucun import à effectuer';
    RETURN json_build_object(
      'inserted', 0,
      'invalid', 0,
      'sources', '{}',
      'duration_ms', 0,
      'warning', 'staging_emission_factors est vide'
    );
  END IF;

  RAISE NOTICE 'Début import depuis staging_emission_factors (% lignes)', v_staging_count;

  -- Nettoyage de emission_factors
  TRUNCATE TABLE public.emission_factors;

  -- Préparation des données
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
          "FE"::numeric,
          "Date"::integer
        ) AS factor_key,
        coalesce(nullif(btrim("Nom"), ''), nullif(btrim("Nom_en"), '')) AS "Nom",
        nullif(btrim("Nom_en"), '') AS "Nom_en",
        coalesce(nullif(btrim("Description"), ''), nullif(btrim("Description_en"), '')) AS "Description",
        nullif(btrim("Description_en"), '') AS "Description_en",
        "FE"::double precision AS "FE",
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
        nullif(btrim("Méthodologie"), '') AS "Méthodologie",
        nullif(btrim("Méthodologie_en"), '') AS "Méthodologie_en",
        nullif(btrim("Type_de_données"), '') AS "Type_de_données",
        nullif(btrim("Type_de_données_en"), '') AS "Type_de_données_en",
        nullif(btrim("Commentaires"), '') AS "Commentaires",
        nullif(btrim("Commentaires_en"), '') AS "Commentaires_en"
      FROM public.staging_emission_factors;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    PERFORM public.log_import_error('Préparation des données', v_error_message, SQLERRM);
    RAISE EXCEPTION 'Erreur lors de la préparation des données: %', v_error_message;
  END;

  -- Identification des lignes invalides
  DROP TABLE IF EXISTS temp_invalid;
  CREATE TEMPORARY TABLE temp_invalid AS
  SELECT * FROM temp_prepared
  WHERE "FE" IS NULL
     OR "Unité donnée d'activité" IS NULL;
  GET DIAGNOSTICS v_invalid = ROW_COUNT;

  IF v_invalid > 0 THEN
    RAISE WARNING '% lignes invalides détectées (FE ou Unité manquante)', v_invalid;
  END IF;

  -- Filtrage des lignes valides
  DROP TABLE IF EXISTS temp_valid;
  CREATE TEMPORARY TABLE temp_valid AS
  SELECT * FROM temp_prepared
  WHERE "FE" IS NOT NULL
    AND "Unité donnée d'activité" IS NOT NULL;

  -- Déduplication
  DROP TABLE IF EXISTS temp_dedup;
  CREATE TEMPORARY TABLE temp_dedup AS
  SELECT DISTINCT ON (factor_key) *
  FROM temp_valid
  ORDER BY factor_key;

  -- Vérification et auto-création des sources manquantes dans fe_sources
  BEGIN
    SELECT array_agg(DISTINCT s.source_name)
    INTO v_missing_sources
    FROM (
      SELECT DISTINCT "Source" as source_name 
      FROM temp_dedup 
      WHERE "Source" IS NOT NULL
    ) s
    LEFT JOIN public.fe_sources fs ON fs.source_name = s.source_name
    WHERE fs.source_name IS NULL;

    IF v_missing_sources IS NOT NULL AND array_length(v_missing_sources, 1) > 0 THEN
      RAISE NOTICE 'Création automatique de % nouvelles sources: %', 
        array_length(v_missing_sources, 1), v_missing_sources;
      
      INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
      SELECT DISTINCT "Source", 'paid', true, true 
      FROM temp_dedup 
      WHERE "Source" = ANY(v_missing_sources)
      ON CONFLICT (source_name) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    PERFORM public.log_import_error('Gestion des sources', v_error_message, SQLERRM);
    -- Ne pas bloquer l'import si cette étape échoue
  END;

  -- Insertion dans emission_factors
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
    
    RAISE NOTICE '% facteurs d''émission insérés avec succès', v_inserted;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    PERFORM public.log_import_error('Insertion emission_factors', v_error_message, SQLERRM);
    RAISE EXCEPTION 'Erreur lors de l''insertion dans emission_factors: %', v_error_message;
  END;

  -- Récupération des sources impactées
  SELECT coalesce(array_agg(DISTINCT "Source"), '{}')
  INTO v_sources
  FROM temp_dedup
  WHERE "Source" IS NOT NULL;

  -- Rebuild de emission_factors_all_search
  BEGIN
    v_rebuild_start := now();
    RAISE NOTICE 'Début rebuild complet de emission_factors_all_search (inclut user_factor_overlays)...';
    PERFORM public.rebuild_emission_factors_all_search();
    v_rebuild_ms := extract(epoch FROM (now() - v_rebuild_start)) * 1000;
    RAISE NOTICE 'Rebuild terminé en % ms', v_rebuild_ms;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    PERFORM public.log_import_error('Rebuild emission_factors_all_search', v_error_message, SQLERRM);
    -- Ne pas bloquer si le rebuild échoue, l'import principal a réussi
    v_rebuild_ms := -1;
  END;

  -- Analyse des statistiques
  BEGIN
    ANALYZE public.emission_factors_all_search;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_import_error('ANALYZE', SQLERRM, NULL);
  END;

  -- Appel Algolia
  BEGIN
    PERFORM public.run_algolia_data_task('914124fb-141d-4239-aeea-784bc5b24f41'::uuid, 'eu');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    PERFORM public.log_import_error('Algolia sync', v_error_message, SQLERRM);
    -- Ne pas bloquer si Algolia échoue
  END;

  -- Retour du résultat
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

COMMENT ON FUNCTION public.run_import_from_staging() IS 'Import depuis staging_emission_factors avec gestion d''erreurs robuste et logging détaillé';
COMMENT ON FUNCTION public.log_import_error(text, text, text) IS 'Fonction utilitaire pour logger les erreurs d''import';

