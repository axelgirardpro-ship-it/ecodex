-- Script de vérification de cohérence entre fe_sources et emission_factors_all_search
-- Détecte les sources dont l'access_level diffère entre la configuration et la table de projection
--
-- Usage: Exécuter ce script régulièrement (manuellement ou via monitoring)
-- pour détecter les incohérences avant qu'elles n'impactent les utilisateurs

-- 1. Détecter les incohérences d'access_level
SELECT 
  'INCOHÉRENCE DÉTECTÉE' as status,
  fs.source_name,
  fs.access_level as config_source,
  efs.access_level as table_search,
  fs.is_global,
  COUNT(DISTINCT efs.object_id) as affected_records,
  'Exécuter: SELECT refresh_ef_all_for_source(''' || fs.source_name || ''');' as fix_command
FROM fe_sources fs
LEFT JOIN emission_factors_all_search efs ON efs."Source" = fs.source_name
WHERE fs.access_level IS DISTINCT FROM efs.access_level
  AND efs.object_id IS NOT NULL
GROUP BY fs.source_name, fs.access_level, efs.access_level, fs.is_global
ORDER BY affected_records DESC;

-- 2. Si aucune incohérence, afficher un message de succès
DO $$ 
DECLARE 
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM fe_sources fs
  LEFT JOIN emission_factors_all_search efs ON efs."Source" = fs.source_name
  WHERE fs.access_level IS DISTINCT FROM efs.access_level
    AND efs.object_id IS NOT NULL;
  
  IF v_count = 0 THEN
    RAISE NOTICE '✅ Aucune incohérence détectée - Toutes les sources sont synchronisées';
  ELSE
    RAISE NOTICE '🔴 % source(s) avec incohérence(s) détectée(s)', v_count;
  END IF;
END $$;

-- 3. Vue d'ensemble des sources par access_level
SELECT 
  'STATISTIQUES' as type,
  fs.access_level,
  COUNT(DISTINCT fs.source_name) as nb_sources,
  COUNT(DISTINCT efs.object_id) as nb_records_total
FROM fe_sources fs
LEFT JOIN emission_factors_all_search efs ON efs."Source" = fs.source_name
GROUP BY fs.access_level
ORDER BY fs.access_level;

-- 4. Identifier les sources dans fe_sources mais absentes de emission_factors_all_search
SELECT 
  'SOURCE MANQUANTE DANS PROJECTION' as status,
  fs.source_name,
  fs.access_level,
  fs.is_global,
  fs.auto_detected,
  'Aucun enregistrement dans emission_factors_all_search' as issue
FROM fe_sources fs
LEFT JOIN emission_factors_all_search efs ON efs."Source" = fs.source_name
WHERE efs.object_id IS NULL
ORDER BY fs.source_name;

