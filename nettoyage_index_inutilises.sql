-- Script de nettoyage des index inutilisés
-- Date: 2025-01-15
-- ATTENTION: À exécuter avec précaution après analyse approfondie

-- =============================================
-- PHASE 1: IDENTIFICATION DES INDEX INUTILISÉS
-- =============================================

-- Lister tous les index jamais utilisés avec leur taille
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as scans_count,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    pg_relation_size(indexrelid) as size_bytes,
    'DROP INDEX IF EXISTS public.' || indexname || ';' as drop_command
FROM pg_stat_user_indexes 
WHERE idx_scan = 0 
AND schemaname = 'public'
-- Filtrer les index sur les tables concernées par les warnings
AND tablename IN (
    'fe_source_workspace_assignments',
    'search_quotas',
    'user_sessions', 
    'datasets',
    'users',
    'algolia_performance_metrics',
    'webhook_batch_queue',
    'emission_factors',
    'fe_versions',
    'emission_factors_staging',
    'data_imports',
    'emission_factors_all_search'
)
ORDER BY size_bytes DESC;

-- =============================================
-- PHASE 2: INDEX SPÉCIFIQUES IDENTIFIÉS COMME INUTILISÉS
-- =============================================

-- Index inutilisés identifiés par Supabase Advisor
-- ATTENTION: Vérifier que ces index ne sont pas utilisés dans des cas spéciaux

-- 1. Index sur fe_source_workspace_assignments
-- Ces index semblent redondants ou jamais utilisés
/*
DROP INDEX IF EXISTS public.idx_fe_source_workspace_assignments_workspace_id;
DROP INDEX IF EXISTS public.idx_fe_source_workspace_assignments_workspace_source;
DROP INDEX IF EXISTS public.idx_fe_source_workspace_assignments_source_name;
DROP INDEX IF EXISTS public.idx_fe_source_workspace_assignments_created_at;
*/

-- 2. Index sur search_quotas
/*
DROP INDEX IF EXISTS public.idx_search_quotas_user_updated;
*/

-- 3. Index sur user_sessions
/*
DROP INDEX IF EXISTS public.idx_user_sessions_user_id;
DROP INDEX IF EXISTS public.idx_user_sessions_expires_at;
DROP INDEX IF EXISTS public.idx_user_sessions_user_expires;
*/

-- 4. Index sur datasets
/*
DROP INDEX IF EXISTS public.idx_datasets_workspace_user;
*/

-- 5. Index sur users
/*
DROP INDEX IF EXISTS public.idx_users_user_id;
DROP INDEX IF EXISTS public.idx_users_workspace_id;
DROP INDEX IF EXISTS public.idx_users_email;
*/

-- 6. Index sur algolia_performance_metrics
/*
DROP INDEX IF EXISTS public.idx_algolia_metrics_type_created;
DROP INDEX IF EXISTS public.idx_algolia_metrics_workspace;
DROP INDEX IF EXISTS public.idx_algolia_metrics_user;
*/

-- 7. Index sur webhook_batch_queue
/*
DROP INDEX IF EXISTS public.idx_webhook_batch_status_priority;
DROP INDEX IF EXISTS public.idx_webhook_batch_source;
*/

-- 8. Index sur emission_factors
/*
DROP INDEX IF EXISTS public.idx_emission_factors_workspace_dataset;
DROP INDEX IF EXISTS public.idx_emission_factors_factor_key;
DROP INDEX IF EXISTS public.idx_emission_factors_is_latest;
DROP INDEX IF EXISTS public.idx_emission_factors_language;
*/

-- 9. Index sur fe_versions
/*
DROP INDEX IF EXISTS public.idx_fe_versions_created_at;
DROP INDEX IF EXISTS public.idx_fe_versions_language;
*/

-- 10. Index sur emission_factors_staging
/*
DROP INDEX IF EXISTS public.idx_emission_factors_staging_data_import;
DROP INDEX IF EXISTS public.idx_emission_factors_staging_workspace;
*/

-- 11. Index sur data_imports
/*
DROP INDEX IF EXISTS public.idx_data_imports_workspace_created;
DROP INDEX IF EXISTS public.idx_data_imports_status;
*/

-- 12. Index sur emission_factors_all_search
/*
DROP INDEX IF EXISTS public.ef_all_scope_idx;
DROP INDEX IF EXISTS public.ef_all_workspace_idx;
DROP INDEX IF EXISTS public.ef_all_languages_gin;
*/

-- =============================================
-- PHASE 3: SCRIPT DE NETTOYAGE PROGRESSIF
-- =============================================

-- Script pour supprimer les index par ordre de priorité (plus gros d'abord)
-- DÉCOMMENTER SEULEMENT APRÈS VALIDATION

DO $$
DECLARE
    index_record RECORD;
    total_saved BIGINT := 0;
BEGIN
    -- Supprimer les index jamais utilisés de plus de 1MB
    FOR index_record IN (
        SELECT indexname, pg_relation_size(indexrelid) as size_bytes
        FROM pg_stat_user_indexes 
        WHERE idx_scan = 0 
        AND schemaname = 'public'
        AND pg_relation_size(indexrelid) > 1048576  -- 1MB
        ORDER BY pg_relation_size(indexrelid) DESC
    ) LOOP
        -- DÉCOMMENTER POUR EXÉCUTER:
        -- EXECUTE 'DROP INDEX IF EXISTS public.' || index_record.indexname;
        total_saved := total_saved + index_record.size_bytes;
        RAISE NOTICE 'Index % supprimé, taille: %', 
            index_record.indexname, 
            pg_size_pretty(index_record.size_bytes);
    END LOOP;
    
    RAISE NOTICE 'Espace total économisé: %', pg_size_pretty(total_saved);
END $$;

-- =============================================
-- PHASE 4: VÉRIFICATIONS POST-NETTOYAGE
-- =============================================

-- Vérifier les performances après nettoyage
SELECT 
    schemaname,
    tablename,
    COUNT(*) as remaining_indexes,
    pg_size_pretty(SUM(pg_relation_size(indexrelid))) as total_index_size
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Vérifier qu'aucun index critique n'a été supprimé
SELECT 
    tablename,
    indexname,
    idx_scan,
    'INDEX ACTIF' as status
FROM pg_stat_user_indexes 
WHERE schemaname = 'public'
AND idx_scan > 0
ORDER BY tablename, idx_scan DESC;

-- =============================================
-- NOTES IMPORTANTES
-- =============================================

/*
AVANT D'EXÉCUTER CE SCRIPT:

1. Effectuer une sauvegarde complète de la base de données
2. Tester sur un environnement de développement
3. Analyser les requêtes courantes pour s'assurer qu'elles ne dépendent pas de ces index
4. Surveiller les performances après chaque suppression
5. Décommenter progressivement les commandes DROP INDEX

APRÈS NETTOYAGE:

1. Surveiller les logs de performance
2. Identifier si des requêtes deviennent lentes
3. Recréer les index si nécessaire
4. Mettre à jour les statistiques avec ANALYZE

ROLLBACK EN CAS DE PROBLÈME:

Si des performances se dégradent, recréer les index avec:
CREATE INDEX [nom_index] ON [table]([colonnes]);

Les définitions originales des index peuvent être retrouvées dans:
- Les migrations Supabase
- pg_dump de la base avant modification
*/



