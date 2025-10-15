-- Migration: Rafraîchissement asynchrone des sources et nettoyage automatique
-- Objectif: Éviter les timeouts lors des assignations et gérer automatiquement
--           le passage de sources 'paid' à 'free'

-- 1. Fonction wrapper pour rafraîchissement asynchrone
CREATE OR REPLACE FUNCTION public.schedule_source_refresh(p_source TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Envoyer notification pour traitement asynchrone
  PERFORM pg_notify(
    'source_assignment_changed',
    json_build_object(
      'source_name', p_source,
      'timestamp', NOW()
    )::text
  );
END;
$$;

COMMENT ON FUNCTION public.schedule_source_refresh IS 
'Planifie un rafraîchissement asynchrone de la projection pour une source donnée';

-- 2. Fonction de nettoyage automatique des assignations
CREATE OR REPLACE FUNCTION public.cleanup_free_source_assignments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Si la source passe à 'free', supprimer toutes ses assignations
  IF NEW.access_level = 'free' AND OLD.access_level = 'paid' THEN
    DELETE FROM public.fe_source_workspace_assignments
    WHERE source_name = NEW.source_name;
    
    RAISE NOTICE 'Nettoyage des assignations pour la source % (passage à free)', NEW.source_name;
    
    -- Notifier pour rafraîchissement
    PERFORM pg_notify(
      'source_freed',
      json_build_object(
        'source_name', NEW.source_name,
        'timestamp', NOW()
      )::text
    );
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.cleanup_free_source_assignments IS 
'Nettoie automatiquement les assignations workspace quand une source devient free';

-- 3. Créer le trigger de nettoyage
DROP TRIGGER IF EXISTS trg_cleanup_free_source_assignments ON public.fe_sources;

CREATE TRIGGER trg_cleanup_free_source_assignments
AFTER UPDATE OF access_level ON public.fe_sources
FOR EACH ROW
WHEN (NEW.access_level = 'free' AND OLD.access_level = 'paid')
EXECUTE FUNCTION public.cleanup_free_source_assignments();

-- 4. Fonction helper pour récupérer le nom exact d'une source (case-insensitive)
-- Cette fonction est utilisée par l'Edge Function pour garantir la cohérence
CREATE OR REPLACE FUNCTION public.get_exact_source_name(p_source_name TEXT)
RETURNS TABLE(source_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT fs.source_name
  FROM public.fe_sources fs
  WHERE fs.source_name ILIKE p_source_name
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.get_exact_source_name IS 
'Retourne le nom exact d''une source (recherche case-insensitive)';

