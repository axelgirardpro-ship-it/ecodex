-- Script d'analyse pour les optimisations de performance
-- Date: 2025-01-15
-- Objectif: Analyser les index et politiques RLS pour optimiser les performances

-- =============================================
-- ANALYSE DES INDEX MANQUANTS SUR LES CLÉS ÉTRANGÈRES
-- =============================================

-- 1. Analyser les contraintes de clés étrangères sans index
WITH foreign_keys AS (
    SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
),
indexes AS (
    SELECT 
        t.relname as table_name,
        a.attname as column_name,
        i.relname as index_name
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    WHERE t.relkind = 'r'
    AND a.attnum > 0
)
SELECT 
    fk.table_name,
    fk.column_name,
    fk.foreign_table_name,
    fk.constraint_name,
    CASE WHEN i.index_name IS NULL THEN 'MANQUANT' ELSE 'EXISTE' END as index_status,
    i.index_name
FROM foreign_keys fk
LEFT JOIN indexes i ON fk.table_name = i.table_name AND fk.column_name = i.column_name
WHERE fk.table_name IN ('data_imports', 'emission_factors')
ORDER BY fk.table_name, index_status;

-- =============================================
-- ANALYSE DES STATISTIQUES D'UTILISATION DES INDEX
-- =============================================

-- 2. Statistiques d'utilisation pour les index suspects
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as scans_performed,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    CASE 
        WHEN idx_scan = 0 THEN 'JAMAIS UTILISÉ'
        WHEN idx_scan < 10 THEN 'RAREMENT UTILISÉ'
        WHEN idx_scan < 100 THEN 'MOYENNEMENT UTILISÉ'
        ELSE 'SOUVENT UTILISÉ'
    END as usage_status
FROM pg_stat_user_indexes 
WHERE tablename IN (
    'data_imports', 
    'emission_factors',
    'fe_source_workspace_assignments',
    'user_sessions', 
    'users',
    'algolia_performance_metrics'
)
ORDER BY tablename, idx_scan DESC;

-- =============================================
-- ANALYSE DES POLITIQUES RLS MULTIPLES
-- =============================================

-- 3. Analyser les politiques RLS sur user_roles
SELECT 
    pol.polname as policy_name,
    pol.polcmd as command_type,
    pol.polpermissive as is_permissive,
    array_to_string(pol.polroles::oid[], ',') as role_oids,
    pg_get_expr(pol.polqual, pol.polrelid) as policy_condition,
    pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_condition
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
WHERE cls.relname = 'user_roles'
ORDER BY pol.polcmd, pol.polname;

-- 4. Analyser l'impact des politiques multiples
SELECT 
    cls.relname as table_name,
    pol.polcmd as command_type,
    COUNT(*) as policy_count,
    string_agg(pol.polname, ', ') as policy_names
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
WHERE pol.polpermissive = true  -- Politiques permissives
GROUP BY cls.relname, pol.polcmd
HAVING COUNT(*) > 1  -- Tables avec politiques multiples
ORDER BY policy_count DESC;

-- =============================================
-- RECOMMANDATIONS AUTOMATISÉES
-- =============================================

-- 5. Script pour générer les commandes de création d'index
SELECT 
    'CREATE INDEX idx_' || table_name || '_' || column_name || 
    ' ON public.' || table_name || '(' || column_name || ');' as create_index_command
FROM (
    WITH foreign_keys AS (
        SELECT
            tc.table_name,
            kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name IN ('data_imports', 'emission_factors')
    ),
    indexes AS (
        SELECT 
            t.relname as table_name,
            a.attname as column_name
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        WHERE t.relkind = 'r'
    )
    SELECT DISTINCT
        fk.table_name,
        fk.column_name
    FROM foreign_keys fk
    LEFT JOIN indexes i ON fk.table_name = i.table_name AND fk.column_name = i.column_name
    WHERE i.column_name IS NULL
) missing_indexes;

-- =============================================
-- CONTRÔLES DE SANTÉ POST-OPTIMISATION
-- =============================================

-- 6. Vérifier la taille des tables et index
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as indexes_size,
    ROUND(100.0 * pg_indexes_size(schemaname||'.'||tablename) / pg_total_relation_size(schemaname||'.'||tablename), 2) as index_ratio
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('data_imports', 'emission_factors', 'user_roles')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;



