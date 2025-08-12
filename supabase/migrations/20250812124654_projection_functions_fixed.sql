-- Migration multi-index: fonctions de rebuild des projections (CORRIGÉE)
-- Date: 2025-08-12
-- Objectif: fonctions pour alimenter ef_public_fr et ef_private_fr

-- ============================================================================
-- 0. Activer l'extension pgcrypto pour les fonctions de hash
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. Fonction de calcul du factor_key (SCD2)
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
  
  -- Hash SHA256 des champs d'identité + scope
  RETURN encode(digest(
    COALESCE(lower(p_nom), '') || '|' ||
    COALESCE(lower(p_unite), '') || '|' ||
    COALESCE(lower(p_source), '') || '|' ||
    COALESCE(lower(p_perimetre), '') || '|' ||
    COALESCE(lower(p_localisation), '') || '|' ||
    v_scope,
    'sha256'::text
  ), 'hex');
END;
$$;

-- ============================================================================
-- 2. Fonction de rebuild projection PUBLIC FR (ef_public_fr)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rebuild_emission_factors_public_search_fr()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vider la projection
  TRUNCATE TABLE public.emission_factors_public_search_fr;
  
  -- Insérer les facteurs STANDARD globaux (complets)
  INSERT INTO public.emission_factors_public_search_fr (
    object_id, group_id, variant, variant_rank,
    "Nom", "Description", "FE", "Unité donnée d'activité", "Périmètre",
    "Secteur", "Sous-secteur", "Localisation", "Date", "Incertitude", "Commentaires", "Source",
    access_level, is_global, is_blurred, language, assigned_workspace_ids
  )
  SELECT 
    ef.id as object_id,
    ef.id as group_id,
    'full' as variant,
    1 as variant_rank,
    ef."Nom",
    ef."Description", 
    ef."FE",
    ef."Unité donnée d'activité",
    ef."Périmètre",
    ef."Secteur",
    ef."Sous-secteur", 
    ef."Localisation",
    CASE WHEN ef."Date" ~ '^\d+$' THEN ef."Date"::integer ELSE NULL END as "Date",
    ef."Incertitude",
    ef."Commentaires",
    ef."Source",
    fs.access_level,
    fs.is_global,
    false as is_blurred,
    ef.language,
    NULL::uuid[] as assigned_workspace_ids
  FROM public.emission_factors ef
  JOIN public.fe_sources fs ON fs.source_name = ef."Source"
  WHERE ef.is_latest = true
    AND ef.workspace_id IS NULL  -- Global uniquement
    AND fs.is_global = true
    AND fs.access_level = 'standard'
    AND ef.language = 'fr';
  
  -- Insérer les facteurs PREMIUM globaux - TEASER (floutés)
  INSERT INTO public.emission_factors_public_search_fr (
    object_id, group_id, variant, variant_rank,
    "Nom", "Description", "FE", "Unité donnée d'activité", "Périmètre", 
    "Secteur", "Sous-secteur", "Localisation", "Date", "Incertitude", "Commentaires", "Source",
    access_level, is_global, is_blurred, language, assigned_workspace_ids
  )
  SELECT 
    gen_random_uuid() as object_id,  -- ID unique pour le teaser
    ef.id as group_id,
    'teaser' as variant,
    0 as variant_rank,
    ef."Nom",
    NULL as "Description",           -- FLOUTÉ
    NULL as "FE",                    -- FLOUTÉ  
    NULL as "Unité donnée d'activité", -- FLOUTÉ
    ef."Périmètre",                  -- Visible
    ef."Secteur",
    ef."Sous-secteur",
    ef."Localisation", 
    CASE WHEN ef."Date" ~ '^\d+$' THEN ef."Date"::integer ELSE NULL END as "Date",
    ef."Incertitude",
    NULL as "Commentaires",          -- FLOUTÉ
    ef."Source", 
    fs.access_level,
    fs.is_global,
    true as is_blurred,
    ef.language,
    NULL::uuid[] as assigned_workspace_ids
  FROM public.emission_factors ef
  JOIN public.fe_sources fs ON fs.source_name = ef."Source"
  WHERE ef.is_latest = true
    AND ef.workspace_id IS NULL  -- Global uniquement
    AND fs.is_global = true
    AND fs.access_level = 'premium'
    AND ef.language = 'fr';
  
  -- Insérer les facteurs PREMIUM globaux - FULL (pour workspaces assignés)
  INSERT INTO public.emission_factors_public_search_fr (
    object_id, group_id, variant, variant_rank,
    "Nom", "Description", "FE", "Unité donnée d'activité", "Périmètre",
    "Secteur", "Sous-secteur", "Localisation", "Date", "Incertitude", "Commentaires", "Source",
    access_level, is_global, is_blurred, language, assigned_workspace_ids
  )
  SELECT 
    ef.id as object_id,
    ef.id as group_id,
    'full' as variant,
    1 as variant_rank,
    ef."Nom",
    ef."Description",                -- COMPLET
    ef."FE",                         -- COMPLET
    ef."Unité donnée d'activité",    -- COMPLET
    ef."Périmètre",
    ef."Secteur",
    ef."Sous-secteur",
    ef."Localisation",
    CASE WHEN ef."Date" ~ '^\d+$' THEN ef."Date"::integer ELSE NULL END as "Date",
    ef."Incertitude", 
    ef."Commentaires",               -- COMPLET
    ef."Source",
    fs.access_level,
    fs.is_global,
    false as is_blurred,
    ef.language,
    -- Agréger les workspaces assignés à cette source
    COALESCE(
      (SELECT array_agg(fsa.workspace_id) 
       FROM public.fe_source_workspace_assignments fsa 
       WHERE fsa.source_name = ef."Source"),
      ARRAY[]::uuid[]
    ) as assigned_workspace_ids
  FROM public.emission_factors ef
  JOIN public.fe_sources fs ON fs.source_name = ef."Source"
  WHERE ef.is_latest = true
    AND ef.workspace_id IS NULL  -- Global uniquement
    AND fs.is_global = true
    AND fs.access_level = 'premium'
    AND ef.language = 'fr'
    -- Seulement si au moins un workspace est assigné
    AND EXISTS (
      SELECT 1 FROM public.fe_source_workspace_assignments fsa 
      WHERE fsa.source_name = ef."Source"
    );
  
  -- Log du nombre d'enregistrements créés
  RAISE NOTICE 'Projection ef_public_fr rebuilt: % records', 
    (SELECT count(*) FROM public.emission_factors_public_search_fr);
END;
$$;

-- ============================================================================
-- 3. Fonction de rebuild projection PRIVATE FR (ef_private_fr)  
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rebuild_emission_factors_private_search_fr()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Vider la projection
  TRUNCATE TABLE public.emission_factors_private_search_fr;
  
  -- Insérer tous les facteurs PRIVÉS (imports utilisateurs)
  INSERT INTO public.emission_factors_private_search_fr (
    object_id,
    "Nom", "Description", "FE", "Unité donnée d'activité", "Périmètre",
    "Secteur", "Sous-secteur", "Localisation", "Date", "Incertitude", "Commentaires", "Source", 
    workspace_id, import_type, access_level, is_global, language
  )
  SELECT 
    ef.id as object_id,
    ef."Nom",
    ef."Description",
    ef."FE", 
    ef."Unité donnée d'activité",
    ef."Périmètre",
    ef."Secteur",
    ef."Sous-secteur",
    ef."Localisation",
    CASE WHEN ef."Date" ~ '^\d+$' THEN ef."Date"::integer ELSE NULL END as "Date",
    ef."Incertitude",
    ef."Commentaires",
    ef."Source",
    ef.workspace_id,
    COALESCE(ef.import_type, 'imported') as import_type,
    COALESCE(fs.access_level, 'standard') as access_level,
    COALESCE(fs.is_global, false) as is_global,
    ef.language
  FROM public.emission_factors ef
  LEFT JOIN public.fe_sources fs ON fs.source_name = ef."Source"
  WHERE ef.is_latest = true
    AND ef.workspace_id IS NOT NULL  -- Privés uniquement (imports)
    AND ef.language = 'fr';
  
  -- Log du nombre d'enregistrements créés
  RAISE NOTICE 'Projection ef_private_fr rebuilt: % records',
    (SELECT count(*) FROM public.emission_factors_private_search_fr);
END;
$$;

-- ============================================================================
-- 4. Fonction de rebuild COMPLET (public + private)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rebuild_all_projections_fr()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.rebuild_emission_factors_public_search_fr();
  PERFORM public.rebuild_emission_factors_private_search_fr();
  
  RAISE NOTICE 'All FR projections rebuilt successfully';
END;
$$;

-- ============================================================================
-- 5. Fonction d'initialisation des factor_key manquants
-- ============================================================================

CREATE OR REPLACE FUNCTION public.initialize_factor_keys()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
BEGIN
  -- Calculer factor_key pour les enregistrements qui n'en ont pas
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
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Initialized factor_key for % records', updated_count;
END;
$$;

-- ============================================================================
-- 6. Permissions pour les fonctions
-- ============================================================================

-- Permettre aux supra admins d'exécuter les rebuilds
GRANT EXECUTE ON FUNCTION public.rebuild_emission_factors_public_search_fr() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rebuild_emission_factors_private_search_fr() TO authenticated;  
GRANT EXECUTE ON FUNCTION public.rebuild_all_projections_fr() TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_factor_key(text,text,text,text,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_factor_keys() TO authenticated;

-- ============================================================================
-- 7. Initialisation: calculer les factor_key et faire un premier rebuild
-- ============================================================================

-- Initialiser les factor_key manquants
SELECT public.initialize_factor_keys();

-- Premier rebuild des projections avec les données existantes
SELECT public.rebuild_all_projections_fr();

-- ============================================================================
-- Fin de migration
-- ============================================================================
