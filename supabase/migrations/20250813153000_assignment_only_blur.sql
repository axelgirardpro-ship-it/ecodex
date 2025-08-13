-- Migration: Assignment-only blur logic
-- 1) Replacer la fonction de rebuild de la projection publique (full premium toujours indexé)
-- 2) Ajouter des triggers d'auto-assignation des sources standard

-- ============================================================================
-- 1. Fonction de rebuild projection PUBLIC FR (ef_public_fr) - mise à jour
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
    AND ef.workspace_id IS NULL
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
    gen_random_uuid() as object_id,
    ef.id as group_id,
    'teaser' as variant,
    0 as variant_rank,
    ef."Nom",
    NULL as "Description",
    NULL as "FE",
    NULL as "Unité donnée d'activité",
    ef."Périmètre",
    ef."Secteur",
    ef."Sous-secteur",
    ef."Localisation", 
    CASE WHEN ef."Date" ~ '^\d+$' THEN ef."Date"::integer ELSE NULL END as "Date",
    ef."Incertitude",
    NULL as "Commentaires",
    ef."Source", 
    fs.access_level,
    fs.is_global,
    true as is_blurred,
    ef.language,
    NULL::uuid[] as assigned_workspace_ids
  FROM public.emission_factors ef
  JOIN public.fe_sources fs ON fs.source_name = ef."Source"
  WHERE ef.is_latest = true
    AND ef.workspace_id IS NULL
    AND fs.is_global = true
    AND fs.access_level = 'premium'
    AND ef.language = 'fr';
  
  -- Insérer les facteurs PREMIUM globaux - FULL (toujours indexés; contrôle d'accès côté requête)
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
    ARRAY[]::uuid[] as assigned_workspace_ids
  FROM public.emission_factors ef
  JOIN public.fe_sources fs ON fs.source_name = ef."Source"
  WHERE ef.is_latest = true
    AND ef.workspace_id IS NULL
    AND fs.is_global = true
    AND fs.access_level = 'premium'
    AND ef.language = 'fr';
  
  RAISE NOTICE 'Projection ef_public_fr rebuilt: % records', 
    (SELECT count(*) FROM public.emission_factors_public_search_fr);
END;
$$;

-- ============================================================================
-- 2. Triggers d'auto-assignation des sources standard
-- ============================================================================

DO $$
BEGIN
  -- À la création d'un workspace: assigner toutes les sources standard globales
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_ws_auto_assign_standard') THEN
    CREATE OR REPLACE FUNCTION public.ws_auto_assign_standard()
    RETURNS trigger AS $$
    BEGIN
      INSERT INTO public.fe_source_workspace_assignments (source_name, workspace_id, assigned_by)
      SELECT fs.source_name, NEW.id, NEW.owner_id
      FROM public.fe_sources fs
      WHERE fs.is_global = true AND fs.access_level = 'standard'
      ON CONFLICT DO NOTHING;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql SECURITY DEFINER;

    CREATE TRIGGER tr_ws_auto_assign_standard
    AFTER INSERT ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.ws_auto_assign_standard();
  END IF;

  -- À l'insertion d'une source standard: assigner à tous les workspaces
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_fe_assign_on_insert_standard') THEN
    CREATE OR REPLACE FUNCTION public.fe_assign_on_insert_standard()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.is_global = true AND NEW.access_level = 'standard' THEN
        INSERT INTO public.fe_source_workspace_assignments (source_name, workspace_id)
        SELECT NEW.source_name, w.id FROM public.workspaces w
        ON CONFLICT DO NOTHING;
      END IF;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql SECURITY DEFINER;

    CREATE TRIGGER tr_fe_assign_on_insert_standard
    AFTER INSERT ON public.fe_sources
    FOR EACH ROW EXECUTE FUNCTION public.fe_assign_on_insert_standard();
  END IF;

  -- Si une source passe premium->standard: assigner aux workspaces manquants
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_fe_assign_on_update_to_standard') THEN
    CREATE OR REPLACE FUNCTION public.fe_assign_on_update_to_standard()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.is_global = true AND NEW.access_level = 'standard' AND OLD.access_level <> 'standard' THEN
        INSERT INTO public.fe_source_workspace_assignments (source_name, workspace_id)
        SELECT NEW.source_name, w.id FROM public.workspaces w
        ON CONFLICT DO NOTHING;
      END IF;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql SECURITY DEFINER;

    CREATE TRIGGER tr_fe_assign_on_update_to_standard
    AFTER UPDATE OF access_level ON public.fe_sources
    FOR EACH ROW EXECUTE FUNCTION public.fe_assign_on_update_to_standard();
  END IF;
END $$;


