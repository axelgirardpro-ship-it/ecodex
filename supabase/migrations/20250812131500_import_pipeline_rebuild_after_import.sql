-- Import pipeline: staging ID + SCD2 helpers + rebuild orchestration (FR)
-- Date: 2025-08-12

-- ============================================================================
-- 1) Staging: ajouter la colonne ID (texte) pour le mapping stable
-- ============================================================================

ALTER TABLE public.emission_factors_staging
  ADD COLUMN IF NOT EXISTS "ID" text;

COMMENT ON COLUMN public.emission_factors_staging."ID" IS 'Identifiant stable du facteur (fourni dans le CSV, sinon calculable)';

-- ============================================================================
-- 2) calculate_factor_key sans dépendance pgcrypto (concat déterministe)
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
  v_scope := COALESCE(p_workspace_id::text, 'global') || '|' || COALESCE(p_language, 'fr');
  RETURN 
    COALESCE(lower(p_nom), '') || '|' ||
    COALESCE(lower(p_unite), '') || '|' ||
    COALESCE(lower(p_source), '') || '|' ||
    COALESCE(lower(p_perimetre), '') || '|' ||
    COALESCE(lower(p_localisation), '') || '|' ||
    v_scope;
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_factor_key(text,text,text,text,text,uuid,text) TO authenticated;

-- ============================================================================
-- 3) Orchestration: rebuild complet FR après un import
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rebuild_after_import_fr(p_import_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si la table data_imports existe, marquer l'état en rebuilding
  BEGIN
    UPDATE public.data_imports 
      SET status = 'rebuilding', updated_at = now()
      WHERE id = p_import_id;
  EXCEPTION WHEN undefined_table THEN
    -- ignorer si data_imports n'existe pas dans cet environnement
    NULL;
  END;

  PERFORM public.rebuild_all_projections_fr();

  BEGIN
    UPDATE public.data_imports 
      SET status = 'completed', finished_at = now(), updated_at = now()
      WHERE id = p_import_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rebuild_after_import_fr(uuid) TO authenticated;

-- ============================================================================
-- Fin de migration
-- ============================================================================



