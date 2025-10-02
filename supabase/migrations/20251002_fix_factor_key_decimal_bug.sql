-- Migration CRITIQUE: Corriger le bug de factor_key qui arrondit les FE < 1 à 0
-- Date: 2025-10-02
-- Bug: to_char(p_fe, 'FM999999999.############') arrondit 0.461 → "0" et 1234.567 → "1235"
-- Impact: 10,985 faux doublons créés, notamment les 69 variations d'électricité

BEGIN;

-- Corriger la fonction calculate_factor_key
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
  -- FIX: Utiliser ::text au lieu de to_char() pour préserver TOUTES les décimales
  v_fe text := coalesce(p_fe::text, '');
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

COMMENT ON FUNCTION public.calculate_factor_key IS 
'Génère une clé unique pour identifier un facteur d''émission.
IMPORTANT: Utilise p_fe::text (pas to_char) pour préserver les décimales.
Bug corrigé: to_char arrondissait 0.461→"0" et 1234.567→"1235"';

-- Créer une fonction pour analyser l'impact de la correction
CREATE OR REPLACE FUNCTION public.analyze_factor_key_fix_impact()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_unique int;
  v_after_fix_unique int;
  v_additional_unique int;
BEGIN
  -- Compter les factor_keys uniques avec l'ANCIENNE méthode (to_char)
  WITH old_method AS (
    SELECT DISTINCT
      coalesce(lower(coalesce(nullif(btrim("Nom"), ''), nullif(btrim("Nom_en"), ''))), '') || '|' ||
      coalesce(lower(coalesce(nullif(btrim("Unité donnée d'activité"), ''), nullif(btrim("Unite_en"), ''))), '') || '|' ||
      coalesce(lower(nullif(btrim("Source"), '')), '') || '|' ||
      coalesce(lower(coalesce(nullif(btrim("Périmètre"), ''), nullif(btrim("Périmètre_en"), ''))), '') || '|' ||
      coalesce(lower(coalesce(nullif(btrim("Localisation"), ''), nullif(btrim("Localisation_en"), ''))), '') || '|' ||
      coalesce(to_char(public.safe_to_numeric(nullif(btrim("FE"), '')), 'FM999999999.############'), '') || '|' ||
      coalesce(public.safe_to_int(nullif(btrim("Date"), ''))::text, '')
      as old_key
    FROM staging_emission_factors
    WHERE nullif(btrim("FE"), '') IS NOT NULL
      AND nullif(btrim("Unité donnée d'activité"), '') IS NOT NULL
  )
  SELECT COUNT(*) INTO v_current_unique FROM old_method;

  -- Compter les factor_keys uniques avec la NOUVELLE méthode (::text)
  WITH new_method AS (
    SELECT DISTINCT
      public.calculate_factor_key(
        coalesce(nullif(btrim("Nom"), ''), nullif(btrim("Nom_en"), '')),
        coalesce(nullif(btrim("Unité donnée d'activité"), ''), nullif(btrim("Unite_en"), '')),
        nullif(btrim("Source"), ''),
        coalesce(nullif(btrim("Périmètre"), ''), nullif(btrim("Périmètre_en"), '')),
        coalesce(nullif(btrim("Localisation"), ''), nullif(btrim("Localisation_en"), '')),
        NULL, NULL,
        public.safe_to_numeric(nullif(btrim("FE"), '')),
        public.safe_to_int(nullif(btrim("Date"), ''))
      ) as new_key
    FROM staging_emission_factors
    WHERE nullif(btrim("FE"), '') IS NOT NULL
      AND nullif(btrim("Unité donnée d'activité"), '') IS NOT NULL
  )
  SELECT COUNT(*) INTO v_after_fix_unique FROM new_method;

  v_additional_unique := v_after_fix_unique - v_current_unique;

  RETURN json_build_object(
    'before_fix_unique_keys', v_current_unique,
    'after_fix_unique_keys', v_after_fix_unique,
    'additional_unique_records', v_additional_unique,
    'false_duplicates_eliminated', v_additional_unique,
    'message', format('Le fix permettra de conserver %s records supplémentaires qui étaient faussement considérés comme doublons', v_additional_unique)
  );
END;
$$;

COMMENT ON FUNCTION public.analyze_factor_key_fix_impact IS 
'Analyse l''impact de la correction du bug factor_key.
Retourne le nombre de records qui seront préservés après le fix.';

COMMIT;

