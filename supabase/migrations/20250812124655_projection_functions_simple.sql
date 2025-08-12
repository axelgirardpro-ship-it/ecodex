-- Migration multi-index: fonctions de rebuild des projections (VERSION SIMPLIFIÉE)
-- Date: 2025-08-12
-- Objectif: fonctions pour alimenter ef_public_fr et ef_private_fr

-- ============================================================================
-- 1. Fonction de calcul du factor_key (SCD2) - VERSION SIMPLE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calculate_factor_key(
  p_nom text,
  p_unite text, 
  p_source text,
  p_perimetre text,
  p_localisation text,
  p_workspace_id uuid,
  p_language text DEFAULT 'fr'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scope text;
BEGIN
  -- Le scope inclut workspace (null = 'global') et language
  v_scope := COALESCE(p_workspace_id::text, 'global') || '|' || COALESCE(p_language, 'fr');
  
  -- Clé simple basée sur la concaténation (pas de hash pour éviter les problèmes d'extension)
  RETURN lower(
    COALESCE(p_nom, '') || '|' ||
    COALESCE(p_unite, '') || '|' ||
    COALESCE(p_source, '') || '|' ||
    COALESCE(p_perimetre, '') || '|' ||
    COALESCE(p_localisation, '') || '|' ||
    v_scope
  );
END;
$$;

-- ============================================================================
-- 2. Fonction d'initialisation des factor_key
-- ============================================================================

CREATE OR REPLACE FUNCTION public.initialize_factor_keys()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Mettre à jour les factor_key manquants
  UPDATE public.emission_factors
  SET factor_key = public.calculate_factor_key(
    "Nom",
    "Unité donnée d'activité", 
    "Source",
    "Périmètre",
    "Localisation",
    workspace_id,
    COALESCE(language, 'fr')
  )
  WHERE factor_key IS NULL;

  RAISE NOTICE 'Initialized factor_key for % records', 
    (SELECT COUNT(*) FROM public.emission_factors WHERE factor_key IS NOT NULL);
END;
$$;

-- ============================================================================
-- 3. Fonction de rebuild de ef_public_fr
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rebuild_ef_public_fr()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vider la table de projection
  DELETE FROM public.emission_factors_public_search_fr;
  
  -- Insérer les facteurs globaux (is_global=true)
  WITH global_factors AS (
    SELECT 
      ef.*,
      fs.access_level,
      fs.assigned_workspace_ids
    FROM public.emission_factors ef
    JOIN public.fe_sources fs ON fs.name = ef."Source"
    WHERE ef.is_latest = true
      AND ef.language = 'fr'
      AND fs.is_global = true
  )
  INSERT INTO public.emission_factors_public_search_fr (
    id, factor_key, version_id, workspace_id, language, import_type,
    "Nom", "Description", "FE", "Unité donnée d'activité", "Périmètre",
    "Secteur", "Sous-secteur", "Localisation", "Date", "Incertitude", 
    "Source", "Commentaires", valid_from, valid_to, is_latest,
    -- Champs spécifiques projection
    group_id, variant, variant_rank, access_level, is_blurred, assigned_workspace_ids
  )
  SELECT 
    -- Colonnes de base
    gf.id, gf.factor_key, gf.version_id, gf.workspace_id, gf.language, gf.import_type,
    gf."Nom", gf."Description", gf."FE", gf."Unité donnée d'activité", gf."Périmètre",
    gf."Secteur", gf."Sous-secteur", gf."Localisation", gf."Date", gf."Incertitude", 
    gf."Source", gf."Commentaires", gf.valid_from, gf.valid_to, gf.is_latest,
    -- Projection: variante teaser (premium flouté)
    gf.id as group_id,
    'teaser' as variant,
    0 as variant_rank,
    gf.access_level,
    true as is_blurred,
    NULL::uuid[] as assigned_workspace_ids
  FROM global_factors gf
  WHERE gf.access_level = 'premium'
  
  UNION ALL
  
  SELECT 
    -- Colonnes de base (ID différent pour éviter conflit)
    gf.id + 1000000 as id, gf.factor_key, gf.version_id, gf.workspace_id, gf.language, gf.import_type,
    gf."Nom", 
    CASE WHEN gf.access_level = 'premium' THEN NULL ELSE gf."Description" END,
    CASE WHEN gf.access_level = 'premium' THEN NULL ELSE gf."FE" END,
    gf."Unité donnée d'activité", gf."Périmètre",
    gf."Secteur", gf."Sous-secteur", gf."Localisation", gf."Date", gf."Incertitude", 
    gf."Source", 
    CASE WHEN gf.access_level = 'premium' THEN NULL ELSE gf."Commentaires" END,
    gf.valid_from, gf.valid_to, gf.is_latest,
    -- Projection: variante full
    gf.id as group_id,
    'full' as variant,
    1 as variant_rank,
    gf.access_level,
    false as is_blurred,
    gf.assigned_workspace_ids
  FROM global_factors gf
  
  UNION ALL
  
  -- Facteurs standard (une seule variante, pas de blur)
  SELECT 
    gf.id, gf.factor_key, gf.version_id, gf.workspace_id, gf.language, gf.import_type,
    gf."Nom", gf."Description", gf."FE", gf."Unité donnée d'activité", gf."Périmètre",
    gf."Secteur", gf."Sous-secteur", gf."Localisation", gf."Date", gf."Incertitude", 
    gf."Source", gf."Commentaires", gf.valid_from, gf.valid_to, gf.is_latest,
    -- Projection: variante unique
    gf.id as group_id,
    'full' as variant,
    1 as variant_rank,
    gf.access_level,
    false as is_blurred,
    gf.assigned_workspace_ids
  FROM global_factors gf
  WHERE gf.access_level = 'standard';

  RAISE NOTICE 'Projection ef_public_fr rebuilt: % records', 
    (SELECT COUNT(*) FROM public.emission_factors_public_search_fr);
END;
$$;

-- ============================================================================
-- 4. Fonction de rebuild de ef_private_fr
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rebuild_ef_private_fr()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vider la table de projection
  DELETE FROM public.emission_factors_private_search_fr;
  
  -- Insérer uniquement les imports utilisateurs (workspace_id NOT NULL)
  INSERT INTO public.emission_factors_private_search_fr (
    id, factor_key, version_id, workspace_id, language, import_type,
    "Nom", "Description", "FE", "Unité donnée d'activité", "Périmètre",
    "Secteur", "Sous-secteur", "Localisation", "Date", "Incertitude", 
    "Source", "Commentaires", valid_from, valid_to, is_latest,
    -- Champs spécifiques projection (simples pour private)
    group_id, variant, variant_rank, access_level, is_blurred, assigned_workspace_ids
  )
  SELECT 
    ef.id, ef.factor_key, ef.version_id, ef.workspace_id, ef.language, ef.import_type,
    ef."Nom", ef."Description", ef."FE", ef."Unité donnée d'activité", ef."Périmètre",
    ef."Secteur", ef."Sous-secteur", ef."Localisation", ef."Date", ef."Incertitude", 
    ef."Source", ef."Commentaires", ef.valid_from, ef.valid_to, ef.is_latest,
    -- Projection: toujours full, jamais de blur
    ef.id as group_id,
    'full' as variant,
    1 as variant_rank,
    'standard' as access_level,
    false as is_blurred,
    NULL::uuid[] as assigned_workspace_ids
  FROM public.emission_factors ef
  WHERE ef.is_latest = true
    AND ef.language = 'fr'
    AND ef.workspace_id IS NOT NULL;

  RAISE NOTICE 'Projection ef_private_fr rebuilt: % records', 
    (SELECT COUNT(*) FROM public.emission_factors_private_search_fr);
END;
$$;

-- ============================================================================
-- 5. Exécution de l'initialisation
-- ============================================================================

-- Initialiser les factor_key
SELECT public.initialize_factor_keys();

-- Premier rebuild des projections
SELECT public.rebuild_ef_public_fr();
SELECT public.rebuild_ef_private_fr();

-- Fin de migration
RAISE NOTICE 'Migration terminée. Tables de projection créées et alimentées.';
