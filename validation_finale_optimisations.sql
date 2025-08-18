-- Script de validation finale des optimisations
-- Date: 2025-01-15
-- Objectif: Vérifier que toutes les optimisations ont été correctement appliquées

-- =============================================
-- VALIDATION 1: CORRECTIONS DE SÉCURITÉ
-- =============================================

-- 1.1 Vérifier que les fonctions ont le search_path sécurisé
SELECT 
    p.proname as function_name,
    CASE 
        WHEN p.proconfig IS NULL THEN '❌ PAS DE CONFIG'
        WHEN 'search_path=public' = ANY(p.proconfig) THEN '✅ SÉCURISÉ'
        ELSE '⚠️ CONFIG AUTRE: ' || array_to_string(p.proconfig, ', ')
    END as security_status,
    p.proconfig as config_details
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN ('can_view_user_roles', 'can_manage_user_roles')
ORDER BY p.proname;

-- 1.2 Vérifier les politiques RLS sur emission_factors_all_search
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '❌ AUCUNE POLITIQUE'
        WHEN COUNT(*) >= 1 THEN '✅ POLITIQUES CRÉÉES (' || COUNT(*) || ')'
        ELSE '⚠️ ÉTAT INCONNU'
    END as rls_status,
    COUNT(*) as policy_count,
    string_agg(pol.polname, ', ') as policy_names
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
WHERE cls.relname = 'emission_factors_all_search';

-- =============================================
-- VALIDATION 2: OPTIMISATIONS DE PERFORMANCE
-- =============================================

-- 2.1 Vérifier les index sur les clés étrangères
WITH foreign_key_indexes AS (
    SELECT 
        'data_imports' as table_name,
        'version_id' as column_name,
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE tablename = 'data_imports' 
                AND indexdef LIKE '%version_id%'
            ) THEN '✅ INDEX EXISTE'
            ELSE '❌ INDEX MANQUANT'
        END as index_status
    
    UNION ALL
    
    SELECT 
        'emission_factors' as table_name,
        'dataset_id' as column_name,
        CASE 
            WHEN EXISTS (
                SELECT 1 FROM pg_indexes 
                WHERE tablename = 'emission_factors' 
                AND indexdef LIKE '%dataset_id%'
            ) THEN '✅ INDEX EXISTE'
            ELSE '❌ INDEX MANQUANT'
        END as index_status
)
SELECT * FROM foreign_key_indexes;

-- 2.2 Analyser les politiques RLS multiples sur user_roles
SELECT 
    CASE 
        WHEN COUNT(*) > 2 THEN '⚠️ POLITIQUES MULTIPLES (' || COUNT(*) || ') - OPTIMISATION RECOMMANDÉE'
        WHEN COUNT(*) = 1 THEN '✅ POLITIQUE UNIQUE - OPTIMISÉ'
        WHEN COUNT(*) = 2 THEN '⚠️ DEUX POLITIQUES - VÉRIFIER SI CONSOLIDATION POSSIBLE'
        ELSE '❌ AUCUNE POLITIQUE'
    END as rls_optimization_status,
    COUNT(*) as policy_count,
    string_agg(pol.polname, ' | ') as policy_names
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
WHERE cls.relname = 'user_roles'
AND pol.polcmd = 'r';  -- SELECT policies

-- =============================================
-- VALIDATION 3: NETTOYAGE DES INDEX
-- =============================================

-- 3.1 Compter les index inutilisés restants
SELECT 
    COUNT(*) as unused_indexes_count,
    pg_size_pretty(SUM(pg_relation_size(indexrelid))) as total_unused_size,
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ AUCUN INDEX INUTILISÉ'
        WHEN COUNT(*) < 10 THEN '⚠️ QUELQUES INDEX INUTILISÉS (' || COUNT(*) || ')'
        ELSE '❌ BEAUCOUP D''INDEX INUTILISÉS (' || COUNT(*) || ') - NETTOYAGE RECOMMANDÉ'
    END as cleanup_status
FROM pg_stat_user_indexes 
WHERE idx_scan = 0 
AND schemaname = 'public';

-- 3.2 Lister les index inutilisés par taille (Top 10)
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    '🗑️ Candidat suppression' as recommendation
FROM pg_stat_user_indexes 
WHERE idx_scan = 0 
AND schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 10;

-- =============================================
-- VALIDATION 4: MÉTRIQUES GLOBALES
-- =============================================

-- 4.1 Résumé de l'état de sécurité
SELECT 
    'SÉCURITÉ' as category,
    CASE 
        WHEN (
            SELECT COUNT(*) FROM pg_proc p
            WHERE p.proname IN ('can_view_user_roles', 'can_manage_user_roles')
            AND 'search_path=public' = ANY(p.proconfig)
        ) = 2 
        AND (
            SELECT COUNT(*) FROM pg_policy pol
            JOIN pg_class cls ON pol.polrelid = cls.oid
            WHERE cls.relname = 'emission_factors_all_search'
        ) > 0
        THEN '✅ OPTIMAL'
        ELSE '⚠️ AMÉLIORATIONS NÉCESSAIRES'
    END as status;

-- 4.2 Résumé de l'état de performance
SELECT 
    'PERFORMANCE' as category,
    CASE 
        WHEN (
            SELECT COUNT(*) FROM pg_stat_user_indexes 
            WHERE idx_scan = 0 AND schemaname = 'public'
        ) < 5
        AND (
            SELECT COUNT(*) FROM pg_policy pol
            JOIN pg_class cls ON pol.polrelid = cls.oid
            WHERE cls.relname = 'user_roles' AND pol.polcmd = 'r'
        ) <= 1
        THEN '✅ OPTIMAL'
        WHEN (
            SELECT COUNT(*) FROM pg_stat_user_indexes 
            WHERE idx_scan = 0 AND schemaname = 'public'
        ) < 15
        THEN '⚠️ BON MAIS AMÉLIORABLE'
        ELSE '❌ OPTIMISATIONS NÉCESSAIRES'
    END as status;

-- =============================================
-- VALIDATION 5: RECOMMANDATIONS FINALES
-- =============================================

-- 5.1 Actions prioritaires restantes
WITH validation_summary AS (
    SELECT 
        CASE 
            WHEN (
                SELECT COUNT(*) FROM pg_proc p
                WHERE p.proname IN ('can_view_user_roles', 'can_manage_user_roles')
                AND p.proconfig IS NULL
            ) > 0 THEN 'Corriger search_path des fonctions'
            ELSE NULL
        END as security_action,
        
        CASE 
            WHEN (
                SELECT COUNT(*) FROM pg_policy pol
                JOIN pg_class cls ON pol.polrelid = cls.oid
                WHERE cls.relname = 'emission_factors_all_search'
            ) = 0 THEN 'Créer politiques RLS pour emission_factors_all_search'
            ELSE NULL
        END as rls_action,
        
        CASE 
            WHEN (
                SELECT COUNT(*) FROM pg_stat_user_indexes 
                WHERE idx_scan = 0 AND schemaname = 'public'
            ) > 20 THEN 'Nettoyer les index inutilisés'
            ELSE NULL
        END as performance_action
)
SELECT 
    COALESCE(security_action, 'Sécurité OK') as security_todo,
    COALESCE(rls_action, 'Politiques RLS OK') as rls_todo,
    COALESCE(performance_action, 'Performance OK') as performance_todo
FROM validation_summary;

-- =============================================
-- VALIDATION 6: SCORE GLOBAL
-- =============================================

-- 6.1 Calculer un score global d'optimisation
WITH scores AS (
    SELECT 
        -- Score sécurité (0-40 points)
        CASE 
            WHEN (
                SELECT COUNT(*) FROM pg_proc p
                WHERE p.proname IN ('can_view_user_roles', 'can_manage_user_roles')
                AND 'search_path=public' = ANY(p.proconfig)
            ) = 2 THEN 20 ELSE 0
        END +
        CASE 
            WHEN (
                SELECT COUNT(*) FROM pg_policy pol
                JOIN pg_class cls ON pol.polrelid = cls.oid
                WHERE cls.relname = 'emission_factors_all_search'
            ) > 0 THEN 20 ELSE 0
        END as security_score,
        
        -- Score performance (0-60 points)
        CASE 
            WHEN (
                SELECT COUNT(*) FROM pg_stat_user_indexes 
                WHERE idx_scan = 0 AND schemaname = 'public'
            ) < 5 THEN 30
            WHEN (
                SELECT COUNT(*) FROM pg_stat_user_indexes 
                WHERE idx_scan = 0 AND schemaname = 'public'
            ) < 15 THEN 20
            ELSE 10
        END +
        CASE 
            WHEN (
                SELECT COUNT(*) FROM pg_policy pol
                JOIN pg_class cls ON pol.polrelid = cls.oid
                WHERE cls.relname = 'user_roles' AND pol.polcmd = 'r'
            ) = 1 THEN 30
            WHEN (
                SELECT COUNT(*) FROM pg_policy pol
                JOIN pg_class cls ON pol.polrelid = cls.oid
                WHERE cls.relname = 'user_roles' AND pol.polcmd = 'r'
            ) = 2 THEN 20
            ELSE 10
        END as performance_score
)
SELECT 
    security_score,
    performance_score,
    security_score + performance_score as total_score,
    CASE 
        WHEN security_score + performance_score >= 90 THEN '🟢 EXCELLENT'
        WHEN security_score + performance_score >= 70 THEN '🟡 BON'
        WHEN security_score + performance_score >= 50 THEN '🟠 MOYEN'
        ELSE '🔴 FAIBLE'
    END as overall_rating
FROM scores;

-- =============================================
-- FIN DE VALIDATION
-- =============================================

SELECT 
    '🎯 VALIDATION TERMINÉE' as message,
    NOW() as validation_time,
    'Consultez les résultats ci-dessus pour connaître l''état des optimisations' as instructions;



