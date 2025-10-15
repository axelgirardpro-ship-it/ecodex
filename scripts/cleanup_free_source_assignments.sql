-- Script de nettoyage manuel des assignations de sources 'free'
-- À exécuter via l'interface SQL de Supabase

-- 1. Désactiver temporairement les triggers pour éviter les cascades
ALTER TABLE fe_source_workspace_assignments DISABLE TRIGGER ALL;

-- 2. Supprimer toutes les assignations de sources 'free'
DELETE FROM fe_source_workspace_assignments
WHERE source_name IN (
  SELECT source_name 
  FROM fe_sources 
  WHERE access_level = 'free'
);

-- 3. Réactiver les triggers
ALTER TABLE fe_source_workspace_assignments ENABLE TRIGGER ALL;

-- 4. Vérifier le résultat
SELECT 
  'Assignations restantes pour sources free' as check_name,
  COUNT(*) as count
FROM fe_source_workspace_assignments fsa
JOIN fe_sources fs ON fs.source_name = fsa.source_name
WHERE fs.access_level = 'free';

