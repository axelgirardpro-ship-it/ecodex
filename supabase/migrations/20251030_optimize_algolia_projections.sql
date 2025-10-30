-- Migration: Optimisation des tables tampons Algolia
-- Date: 2025-10-30
-- Objectifs:
--   1. Créer table tampon algolia_access_level_projection pour changements access_level ciblés
--   2. Modifier trigger pour remplir cette table au lieu d'updater 625k records
--   3. Créer fonction fill_algolia_assignments_projection pour assignations workspace

-- =====================================================================
-- PARTIE 1: Créer table tampon pour changements access_level
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.algolia_access_level_projection (
  id_fe text PRIMARY KEY,
  source_name text NOT NULL,
  access_level text NOT NULL CHECK (access_level IN ('free', 'paid')),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.algolia_access_level_projection IS
'Table tampon pour synchronisation Algolia lors de changements d''access_level.
Contient uniquement les records de la source modifiée (au lieu des 625k records).
Vidée et remplie à chaque changement d''access_level.
Lue par Task Algolia 22394099-b71a-48ef-9453-e790b3159ade.';

-- RLS pour service_role uniquement
ALTER TABLE public.algolia_access_level_projection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON public.algolia_access_level_projection
  FOR ALL
  USING (auth.role() = 'service_role');

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_algolia_access_level_source 
  ON public.algolia_access_level_projection(source_name);

-- =====================================================================
-- PARTIE 2: Modifier trigger pour utiliser table tampon
-- =====================================================================

CREATE OR REPLACE FUNCTION public.trigger_algolia_on_access_level_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_task_id uuid := '22394099-b71a-48ef-9453-e790b3159ade';
  v_record_count int;
BEGIN
  IF OLD.access_level IS DISTINCT FROM NEW.access_level THEN
    RAISE NOTICE 'Access level changed for source %: % → %. Preparing Algolia sync...', 
      NEW.source_name, OLD.access_level, NEW.access_level;
    
    -- 1. Vider la table tampon
    DELETE FROM public.algolia_access_level_projection;
    
    -- 2. Remplir avec SEULEMENT cette source
    INSERT INTO public.algolia_access_level_projection (id_fe, source_name, access_level)
    SELECT 
      "ID_FE" as id_fe,
      "Source" as source_name,
      NEW.access_level
    FROM public.emission_factors_all_search
    WHERE "Source" = NEW.source_name;
    
    GET DIAGNOSTICS v_record_count = ROW_COUNT;
    RAISE NOTICE 'Filled algolia_access_level_projection with % records for source %', 
      v_record_count, NEW.source_name;
    
    -- 3. Déclencher Task Algolia
    BEGIN
      PERFORM public.run_algolia_data_task(v_task_id, 'eu');
      RAISE NOTICE 'Algolia Task % triggered successfully', v_task_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to trigger Algolia task for source %: %', 
        NEW.source_name, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_algolia_on_access_level_change IS
'Trigger optimisé pour changement d''access_level.
Au lieu de mettre à jour 625k records, remplit algolia_access_level_projection 
avec uniquement les records de la source modifiée (gain ~97%).
Task Algolia 22394099 lit cette table tampon pour partial update ciblé.';

-- =====================================================================
-- PARTIE 3: Fonction pour remplir algolia_source_assignments_projection
-- =====================================================================

CREATE OR REPLACE FUNCTION public.fill_algolia_assignments_projection(p_source text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record_count int;
BEGIN
  -- Vider d'abord la table tampon
  DELETE FROM public.algolia_source_assignments_projection;
  
  -- Remplir avec pagination implicite via INSERT SELECT
  -- COALESCE pour gérer les NULL dans assigned_workspace_ids
  INSERT INTO public.algolia_source_assignments_projection (id_fe, source_name, assigned_workspace_ids)
  SELECT 
    "ID_FE" as id_fe,
    "Source" as source_name,
    COALESCE(assigned_workspace_ids, ARRAY[]::uuid[]) as assigned_workspace_ids
  FROM public.emission_factors_all_search
  WHERE "Source" = p_source;
  
  GET DIAGNOSTICS v_record_count = ROW_COUNT;
  
  RAISE NOTICE 'Filled algolia_source_assignments_projection with % records for source %',
    v_record_count, p_source;
END;
$$;

COMMENT ON FUNCTION public.fill_algolia_assignments_projection IS
'Remplit algolia_source_assignments_projection pour une source donnée.
Vide la table avant de la remplir pour garantir qu''elle contient uniquement 
les records de la source en cours d''assignation.
Appelée par Edge Function schedule-source-reindex.';

-- Grant permissions
GRANT SELECT, INSERT, DELETE ON public.algolia_access_level_projection TO service_role;
GRANT EXECUTE ON FUNCTION public.fill_algolia_assignments_projection TO service_role;

