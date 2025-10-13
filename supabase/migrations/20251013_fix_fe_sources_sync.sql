-- Migration: Fix synchronisation fe_sources et correction du trigger
-- Date: 2025-10-13
-- Problème: Le trigger auto_detect_fe_sources() insère 'standard' au lieu de 'free'/'paid'
-- Conséquence: 145,830 facteurs sans source dans fe_sources
-- Solution: Corriger le trigger + synchroniser les sources manquantes

-- ============================================================================
-- 1. Corriger le trigger pour utiliser 'free' au lieu de 'standard'
-- ============================================================================

DROP FUNCTION IF EXISTS public.auto_detect_fe_sources() CASCADE;

CREATE OR REPLACE FUNCTION public.auto_detect_fe_sources()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert new source if it doesn't exist
  -- ✅ FIX: Utiliser 'free' au lieu de 'standard'
  INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
  VALUES (NEW."Source", 'free', true, true)
  ON CONFLICT (source_name) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Recréer le trigger
CREATE TRIGGER auto_detect_sources_trigger
AFTER INSERT ON public.emission_factors
FOR EACH ROW
WHEN (NEW."Source" IS NOT NULL)
EXECUTE FUNCTION public.auto_detect_fe_sources();

COMMENT ON FUNCTION public.auto_detect_fe_sources() IS 
  'Trigger function: Auto-détecte et insère les nouvelles sources dans fe_sources avec access_level=free';

-- ============================================================================
-- 2. Synchroniser toutes les sources manquantes depuis emission_factors
-- ============================================================================

INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
SELECT DISTINCT 
  ef."Source" as source_name,
  'free' as access_level,
  true as is_global,
  true as auto_detected
FROM public.emission_factors ef
LEFT JOIN public.fe_sources fs ON fs.source_name = ef."Source"
WHERE fs.source_name IS NULL
  AND ef."Source" IS NOT NULL
ON CONFLICT (source_name) DO NOTHING;

-- ============================================================================
-- 3. Ajouter trigger pour user_factor_overlays (imports utilisateur)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_detect_fe_sources_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert new source if it doesn't exist
  INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
  VALUES (NEW."Source", 'free', true, true)
  ON CONFLICT (source_name) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Appliquer le trigger sur user_factor_overlays
DROP TRIGGER IF EXISTS auto_detect_sources_user_trigger ON public.user_factor_overlays;

CREATE TRIGGER auto_detect_sources_user_trigger
AFTER INSERT ON public.user_factor_overlays
FOR EACH ROW
WHEN (NEW."Source" IS NOT NULL)
EXECUTE FUNCTION public.auto_detect_fe_sources_user();

COMMENT ON FUNCTION public.auto_detect_fe_sources_user() IS 
  'Trigger function: Auto-détecte les sources des imports utilisateur pour fe_sources';

-- ============================================================================
-- 4. Synchroniser les sources des imports utilisateur existants
-- ============================================================================

INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
SELECT DISTINCT 
  ufo."Source" as source_name,
  'free' as access_level,
  true as is_global,
  true as auto_detected
FROM public.user_factor_overlays ufo
LEFT JOIN public.fe_sources fs ON fs.source_name = ufo."Source"
WHERE fs.source_name IS NULL
  AND ufo."Source" IS NOT NULL
ON CONFLICT (source_name) DO NOTHING;

-- ============================================================================
-- 5. Mettre à jour run_import_from_staging() pour utiliser 'free'
-- ============================================================================

CREATE OR REPLACE FUNCTION public.run_import_from_staging()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := now();
  v_invalid integer := 0;
  v_total integer := 0;
  v_inserted integer := 0;
  v_error_message text;
  v_missing_sources text[];
  v_algolia_task_id uuid := '419f86b4-4c35-4608-8a88-b8343a457a3a';
BEGIN
  -- Validation : vérifier que staging_emission_factors n'est pas vide
  SELECT count(*) INTO v_total FROM public.staging_emission_factors;
  
  IF v_total = 0 THEN
    RETURN json_build_object(
      'success', false,
      'error', 'La table staging_emission_factors est vide',
      'duration_ms', 0
    );
  END IF;

  RAISE NOTICE 'Début import de % lignes depuis staging', v_total;

  -- Préparation des données avec gestion d'erreur
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
      
      -- ✅ FIX: Utiliser 'free' au lieu de 'standard'
      INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
      SELECT DISTINCT "Source", 'free', true, true 
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
    FROM temp_dedup d
    ON CONFLICT ("ID_FE") DO UPDATE SET
      factor_key = EXCLUDED.factor_key,
      "Nom" = EXCLUDED."Nom",
      "Nom_en" = EXCLUDED."Nom_en",
      "Description" = EXCLUDED."Description",
      "Description_en" = EXCLUDED."Description_en",
      "FE" = EXCLUDED."FE",
      "Unité donnée d'activité" = EXCLUDED."Unité donnée d'activité",
      "Unite_en" = EXCLUDED."Unite_en",
      "Source" = EXCLUDED."Source",
      "Secteur" = EXCLUDED."Secteur",
      "Secteur_en" = EXCLUDED."Secteur_en",
      "Sous-secteur" = EXCLUDED."Sous-secteur",
      "Sous-secteur_en" = EXCLUDED."Sous-secteur_en",
      "Localisation" = EXCLUDED."Localisation",
      "Localisation_en" = EXCLUDED."Localisation_en",
      "Périmètre" = EXCLUDED."Périmètre",
      "Périmètre_en" = EXCLUDED."Périmètre_en",
      "Date" = EXCLUDED."Date",
      "Incertitude" = EXCLUDED."Incertitude",
      "Contributeur" = EXCLUDED."Contributeur",
      "Contributeur_en" = EXCLUDED."Contributeur_en",
      "Méthodologie" = EXCLUDED."Méthodologie",
      "Méthodologie_en" = EXCLUDED."Méthodologie_en",
      "Type_de_données" = EXCLUDED."Type_de_données",
      "Type_de_données_en" = EXCLUDED."Type_de_données_en",
      "Commentaires" = EXCLUDED."Commentaires",
      "Commentaires_en" = EXCLUDED."Commentaires_en",
      updated_at = now();

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    RAISE NOTICE '% lignes insérées/mises à jour dans emission_factors', v_inserted;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    PERFORM public.log_import_error('Insertion emission_factors', v_error_message, SQLERRM);
    RAISE EXCEPTION 'Erreur lors de l''insertion dans emission_factors: %', v_error_message;
  END;

  -- Rebuild de la projection
  PERFORM public.rebuild_emission_factors_all_search();

  -- ANALYZE pour optimiser les plans de requête
  BEGIN
    ANALYZE public.emission_factors;
    ANALYZE public.emission_factors_all_search;
  EXCEPTION WHEN OTHERS THEN
    PERFORM public.log_import_error('ANALYZE', SQLERRM, NULL);
  END;

  -- Synchronisation Algolia
  BEGIN
    PERFORM public.run_algolia_data_task(v_algolia_task_id, 'eu');
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    PERFORM public.log_import_error('Algolia sync', v_error_message, SQLERRM);
    -- Ne pas bloquer si Algolia échoue
  END;

  RETURN json_build_object(
    'success', true,
    'total_rows', v_total,
    'invalid_rows', v_invalid,
    'inserted_rows', v_inserted,
    'duration_ms', extract(epoch FROM (now() - v_start)) * 1000
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

-- ============================================================================
-- 6. Vérification finale
-- ============================================================================

DO $$
DECLARE
  v_ef_sources int;
  v_fe_sources int;
  v_missing int;
BEGIN
  SELECT COUNT(DISTINCT "Source") INTO v_ef_sources 
  FROM public.emission_factors 
  WHERE "Source" IS NOT NULL;
  
  SELECT COUNT(*) INTO v_fe_sources FROM public.fe_sources;
  
  SELECT COUNT(*) INTO v_missing
  FROM (
    SELECT DISTINCT "Source" FROM public.emission_factors WHERE "Source" IS NOT NULL
  ) ef
  LEFT JOIN public.fe_sources fs ON fs.source_name = ef."Source"
  WHERE fs.source_name IS NULL;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ Synchronisation fe_sources terminée:';
  RAISE NOTICE '   - emission_factors: % sources uniques', v_ef_sources;
  RAISE NOTICE '   - fe_sources: % sources enregistrées', v_fe_sources;
  RAISE NOTICE '   - Sources manquantes: %', v_missing;
  
  IF v_missing = 0 THEN
    RAISE NOTICE '🎉 Toutes les sources sont synchronisées!';
  ELSE
    RAISE WARNING '⚠️  Il reste % sources manquantes', v_missing;
  END IF;
  RAISE NOTICE '============================================';
END$$;

