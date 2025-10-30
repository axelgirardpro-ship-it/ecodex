-- Migration: Déclencher automatiquement la Task Algolia lors du changement d'access_level
-- Objectif: Synchroniser Algolia quand une source passe de 'free' à 'paid' ou inversement
-- Task ID Algolia: 22394099-b71a-48ef-9453-e790b3159ade

-- Fonction pour déclencher la Task Algolia après changement d'access_level
CREATE OR REPLACE FUNCTION public.trigger_algolia_on_access_level_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_task_id uuid := '22394099-b71a-48ef-9453-e790b3159ade';
BEGIN
  -- Déclencher uniquement si access_level change
  IF OLD.access_level IS DISTINCT FROM NEW.access_level THEN
    RAISE NOTICE 'Access level changed for source %: % → %. Triggering Algolia sync...', 
      NEW.source_name, OLD.access_level, NEW.access_level;
    
    -- Appeler run_algolia_data_task de manière asynchrone
    -- La fonction existe déjà et est utilisée dans plusieurs migrations
    BEGIN
      PERFORM public.run_algolia_data_task(v_task_id, 'eu');
    EXCEPTION WHEN OTHERS THEN
      -- Logger l'erreur mais ne pas bloquer le trigger
      -- Cela évite qu'un problème Algolia bloque la mise à jour de la source
      RAISE WARNING 'Failed to trigger Algolia task for source %: %', 
        NEW.source_name, SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_algolia_on_access_level_change IS
'Déclenche automatiquement la Task Algolia 22394099-b71a-48ef-9453-e790b3159ade après changement d''access_level d''une source.
Remplace l''Edge Function/cron qui n''existe plus.
Ordre d''exécution des triggers sur fe_sources.access_level:
1. trg_cleanup_free_source_assignments (nettoie les assignations si passage à free)
2. trg_fe_sources_refresh_projection (met à jour emission_factors_all_search)
3. trg_algolia_on_access_level_change (nouveau - synchronise vers Algolia)';

-- Créer le trigger
DROP TRIGGER IF EXISTS trg_algolia_on_access_level_change ON public.fe_sources;

CREATE TRIGGER trg_algolia_on_access_level_change
AFTER UPDATE OF access_level ON public.fe_sources
FOR EACH ROW
WHEN (OLD.access_level IS DISTINCT FROM NEW.access_level)
EXECUTE FUNCTION public.trigger_algolia_on_access_level_change();

COMMENT ON TRIGGER trg_algolia_on_access_level_change ON public.fe_sources IS
'Synchronise automatiquement Algolia après changement d''access_level d''une source';

