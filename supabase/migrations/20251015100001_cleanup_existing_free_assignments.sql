-- Nettoyage des assignations existantes pour les sources 'free'
-- Ces assignations sont obsolètes car les sources 'free' sont accessibles à tous

-- Créer une fonction pour nettoyer par lots (évite les timeouts)
CREATE OR REPLACE FUNCTION public.cleanup_free_source_assignments_batch()
RETURNS TABLE(deleted_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  batch_size INTEGER := 50;
  total_deleted INTEGER := 0;
  rows_deleted INTEGER;
BEGIN
  LOOP
    -- Supprimer un lot d'assignations
    WITH deleted AS (
      DELETE FROM fe_source_workspace_assignments
      WHERE id IN (
        SELECT fsa.id
        FROM fe_source_workspace_assignments fsa
        JOIN fe_sources fs ON fs.source_name = fsa.source_name
        WHERE fs.access_level = 'free'
        LIMIT batch_size
      )
      RETURNING id
    )
    SELECT COUNT(*) INTO rows_deleted FROM deleted;
    
    total_deleted := total_deleted + rows_deleted;
    
    -- Sortir de la boucle si plus rien à supprimer
    EXIT WHEN rows_deleted = 0;
    
    -- Petite pause pour éviter de surcharger
    PERFORM pg_sleep(0.1);
  END LOOP;
  
  RAISE NOTICE 'Nettoyage terminé : % assignations supprimées', total_deleted;
  
  RETURN QUERY SELECT total_deleted;
END;
$$;

-- Exécuter le nettoyage
SELECT * FROM public.cleanup_free_source_assignments_batch();

-- Supprimer la fonction temporaire
DROP FUNCTION IF EXISTS public.cleanup_free_source_assignments_batch();

COMMENT ON TABLE public.fe_source_workspace_assignments IS 
'Table des assignations de sources aux workspaces. Les sources ''free'' ne doivent PAS avoir d''assignations car elles sont accessibles à tous.';

