-- Script pour forcer la synchronisation CBAM vers Algolia
-- Ce script déclenche la fonction edge qui synchronise Algolia

-- Option 1: Via un UPDATE factice sur l'assignment (déclenche le trigger)
UPDATE fe_source_workspace_assignments 
SET created_at = created_at 
WHERE source_name = 'CBAM';

-- Note: Si cela ne déclenche pas la sync Algolia automatiquement,
-- il faudra désassigner puis réassigner CBAM via l'interface admin
-- pour forcer l'appel à la edge function manage-fe-source-assignments

