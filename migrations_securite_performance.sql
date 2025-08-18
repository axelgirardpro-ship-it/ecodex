-- Migration pour corriger les avertissements de sécurité et performance
-- Date: 2025-01-15
-- Objectif: Résoudre les warnings Supabase identifiés via MCP

-- =============================================
-- PARTIE 1: CORRECTIONS DE SÉCURITÉ (PRIORITÉ 1)
-- =============================================

-- 1.1 Corriger les fonctions avec search_path mutable
ALTER FUNCTION public.can_view_user_roles() SET search_path = public;
ALTER FUNCTION public.can_manage_user_roles() SET search_path = public;

-- Vérification
COMMENT ON FUNCTION public.can_view_user_roles() IS 'Function avec search_path sécurisé - corrigé le 2025-01-15';
COMMENT ON FUNCTION public.can_manage_user_roles() IS 'Function avec search_path sécurisé - corrigé le 2025-01-15';

-- 1.2 Ajouter des politiques RLS pour emission_factors_all_search
-- Cette table a RLS activé mais aucune politique

-- Politique pour les utilisateurs authentifiés
CREATE POLICY "Authenticated users can view emission factors search" 
ON public.emission_factors_all_search
FOR SELECT 
TO authenticated
USING (true);

-- Politique pour l'accès anonyme (ajuster selon vos besoins de sécurité)
-- Si vous ne voulez pas d'accès anonyme, commentez cette section
CREATE POLICY "Public access to emission factors search" 
ON public.emission_factors_all_search
FOR SELECT 
TO anon
USING (true);

-- Documentation
COMMENT ON POLICY "Authenticated users can view emission factors search" ON public.emission_factors_all_search 
IS 'Permet aux utilisateurs authentifiés de rechercher dans tous les facteurs d''émission';

COMMENT ON POLICY "Public access to emission factors search" ON public.emission_factors_all_search 
IS 'Permet l''accès public aux facteurs d''émission - AJUSTER SELON VOS BESOINS DE SÉCURITÉ';

-- =============================================
-- PARTIE 2: CORRECTIONS DE PERFORMANCE (PRIORITÉ 2)
-- =============================================

-- 2.1 Ajouter l'index manquant sur data_imports.version_id
-- Vérifier d'abord si l'index n'existe pas déjà
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'data_imports' 
        AND indexname = 'idx_data_imports_version_id'
    ) THEN
        CREATE INDEX idx_data_imports_version_id ON public.data_imports(version_id);
        RAISE NOTICE 'Index idx_data_imports_version_id créé avec succès';
    ELSE
        RAISE NOTICE 'Index idx_data_imports_version_id existe déjà';
    END IF;
END $$;

-- 2.2 Vérifier l'index sur emission_factors.dataset_id
-- D'après notre analyse, il existe déjà mais n'est pas utilisé
-- Analyser les statistiques d'utilisation
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as scans_count,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes 
WHERE tablename = 'emission_factors' 
AND indexname LIKE '%dataset%';

-- =============================================
-- PARTIE 3: OPTIMISATION DES POLITIQUES RLS
-- =============================================

-- 3.1 Analyser les politiques multiples sur user_roles
-- Ces requêtes vous aideront à comprendre les politiques existantes

SELECT 
    pol.polname as policy_name,
    pol.polcmd as policy_command,
    pol.polpermissive as is_permissive,
    pol.polroles as allowed_roles,
    pg_get_expr(pol.polqual, pol.polrelid) as policy_expression
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
WHERE cls.relname = 'user_roles'
ORDER BY pol.polname;

-- =============================================
-- PARTIE 4: NETTOYAGE DES INDEX INUTILISÉS (À FAIRE AVEC PRÉCAUTION)
-- =============================================

-- 4.1 Script pour identifier les index vraiment inutilisés
-- NE PAS EXÉCUTER AUTOMATIQUEMENT - ANALYSER D'ABORD

SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes 
WHERE idx_scan = 0 
AND tablename IN (
    'fe_source_workspace_assignments',
    'user_sessions', 
    'users',
    'algolia_performance_metrics',
    'emission_factors'
)
ORDER BY pg_relation_size(indexrelid) DESC;

-- =============================================
-- VÉRIFICATIONS POST-MIGRATION
-- =============================================

-- Vérifier que les fonctions ont le bon search_path
SELECT 
    p.proname as function_name,
    p.proconfig as config_settings
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN ('can_view_user_roles', 'can_manage_user_roles');

-- Vérifier les politiques RLS sur emission_factors_all_search
SELECT COUNT(*) as policy_count
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
WHERE cls.relname = 'emission_factors_all_search';

-- Vérifier les index sur les clés étrangères
SELECT 
    t.relname as table_name,
    i.relname as index_name,
    a.attname as column_name
FROM pg_class t
JOIN pg_index ix ON t.oid = ix.indrelid
JOIN pg_class i ON i.oid = ix.indexrelid
JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
WHERE t.relname IN ('data_imports', 'emission_factors')
  AND a.attname IN ('version_id', 'dataset_id')
ORDER BY t.relname, i.relname;



