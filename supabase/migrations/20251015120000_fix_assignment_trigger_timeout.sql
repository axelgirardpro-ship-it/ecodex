-- Migration: Correction du timeout lors de l'assignation/désassignation de sources
-- Date: 2025-10-15
-- 
-- Problème résolu:
-- Les triggers sur fe_source_workspace_assignments appelaient refresh_ef_all_for_source
-- de manière synchrone, causant des timeouts (8+ secondes) lors des assignations.
--
-- Solution:
-- Remplacer l'appel synchrone par pg_notify pour un traitement asynchrone.

-- Modifier la fonction de trigger pour utiliser pg_notify (asynchrone)
CREATE OR REPLACE FUNCTION public.tr_refresh_projection_assignments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  -- Utiliser pg_notify pour déclencher un rafraîchissement asynchrone
  -- Le listener PostgreSQL traitera cette notification en arrière-plan
  PERFORM pg_notify('source_refresh_event', coalesce(new.source_name, old.source_name));
  return new;
end;
$function$;

COMMENT ON FUNCTION public.tr_refresh_projection_assignments IS 
'Trigger function qui notifie de manière asynchrone les changements d''assignation de sources. '
'Utilisé par les triggers trg_assignments_refresh_projection_ins/upd/del.';


