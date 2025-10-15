-- Migration: Automatiser rebuild complet de emission_factors_all_search après import
-- Date: 2025-10-02
-- Objectif: S'assurer que user_factor_overlays est toujours inclus après import

BEGIN;

-- Modifier run_import_from_staging pour appeler rebuild complet au lieu de refresh par source
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

  -- CHANGEMENT CLÉ: Appeler rebuild_emission_factors_all_search au lieu de refresh_ef_all_for_source
  -- Cela garantit que user_factor_overlays est TOUJOURS inclus
  v_rebuild_start := now();
  RAISE NOTICE 'Début rebuild complet de emission_factors_all_search (inclut user_factor_overlays)...';
  PERFORM public.rebuild_emission_factors_all_search();
  v_rebuild_ms := extract(epoch FROM (now() - v_rebuild_start)) * 1000;
  RAISE NOTICE 'Rebuild terminé en % ms', v_rebuild_ms;

  ANALYZE public.emission_factors_all_search;

  -- Appeler Algolia après rebuild
  PERFORM public.run_algolia_data_task('55278ecb-f8dc-43d8-8fe6-aff7057b69d0'::uuid, 'eu');

  RETURN json_build_object(
    'inserted', v_inserted,
    'invalid', v_invalid,
    'sources', v_sources,
    'duration_ms', extract(epoch FROM (now() - v_start)) * 1000,
    'rebuild_ms', v_rebuild_ms,
    'all_search_count', (SELECT COUNT(*) FROM public.emission_factors_all_search),
    'user_overlays_included', (SELECT COUNT(*) FROM public.emission_factors_all_search WHERE scope = 'private')
  );
END;
$$;

-- Ajouter un commentaire explicatif
COMMENT ON FUNCTION public.run_import_from_staging() IS 
'Importe staging_emission_factors vers emission_factors, puis rebuild COMPLET de emission_factors_all_search.
Le rebuild complet garantit que user_factor_overlays est toujours inclus (scope=private).
Retourne: inserted, invalid, sources, duration_ms, rebuild_ms, all_search_count, user_overlays_included';

-- Créer une fonction de validation pour vérifier l'intégrité
CREATE OR REPLACE FUNCTION public.validate_emission_factors_all_search()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ef_count int;
  v_ufo_count int;
  v_all_search_count int;
  v_public_count int;
  v_private_count int;
  v_is_valid boolean;
  v_message text;
BEGIN
  SELECT COUNT(*) INTO v_ef_count FROM public.emission_factors;
  SELECT COUNT(*) INTO v_ufo_count FROM public.user_factor_overlays;
  SELECT COUNT(*) INTO v_all_search_count FROM public.emission_factors_all_search;
  SELECT COUNT(*) INTO v_public_count FROM public.emission_factors_all_search WHERE scope = 'public';
  SELECT COUNT(*) INTO v_private_count FROM public.emission_factors_all_search WHERE scope = 'private';
  
  v_is_valid := (v_all_search_count = v_ef_count + v_ufo_count) 
            AND (v_public_count = v_ef_count) 
            AND (v_private_count = v_ufo_count);
  
  IF v_is_valid THEN
    v_message := 'Validation réussie: emission_factors_all_search est cohérent';
  ELSE
    v_message := format(
      'ERREUR: Incohérence détectée! Expected %s + %s = %s, got %s (public=%s, private=%s)',
      v_ef_count, v_ufo_count, v_ef_count + v_ufo_count, v_all_search_count, v_public_count, v_private_count
    );
  END IF;
  
  RETURN json_build_object(
    'is_valid', v_is_valid,
    'message', v_message,
    'emission_factors_count', v_ef_count,
    'user_factor_overlays_count', v_ufo_count,
    'expected_total', v_ef_count + v_ufo_count,
    'all_search_count', v_all_search_count,
    'public_count', v_public_count,
    'private_count', v_private_count
  );
END;
$$;

COMMENT ON FUNCTION public.validate_emission_factors_all_search() IS 
'Valide que emission_factors_all_search contient bien emission_factors + user_factor_overlays.
Retourne un JSON avec is_valid, message, et tous les comptages détaillés.';

COMMIT;

