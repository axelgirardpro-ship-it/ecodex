-- Script d'optimisation des politiques RLS multiples
-- Date: 2025-01-15
-- Objectif: Analyser et consolider les politiques RLS multiples sur user_roles

-- =============================================
-- PHASE 1: ANALYSE DES POLITIQUES EXISTANTES
-- =============================================

-- 1. Lister toutes les politiques sur user_roles
SELECT 
    pol.polname as policy_name,
    pol.polcmd as command_type,
    pol.polpermissive as is_permissive,
    pol.polroles as role_oids,
    pg_get_expr(pol.polqual, pol.polrelid) as policy_condition,
    pg_get_expr(pol.polwithcheck, pol.polrelid) as with_check_condition
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
WHERE cls.relname = 'user_roles'
ORDER BY pol.polcmd, pol.polname;

-- 2. Identifier les rôles concernés par les politiques multiples
SELECT 
    unnest(pol.polroles::oid[]) as role_oid,
    r.rolname as role_name,
    COUNT(*) as policy_count,
    string_agg(pol.polname, ', ') as policy_names
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
LEFT JOIN pg_roles r ON r.oid = ANY(pol.polroles::oid[])
WHERE cls.relname = 'user_roles'
AND pol.polcmd = 'r'  -- SELECT policies
GROUP BY unnest(pol.polroles::oid[]), r.rolname
HAVING COUNT(*) > 1
ORDER BY policy_count DESC;

-- =============================================
-- PHASE 2: ANALYSE DES CONDITIONS DES POLITIQUES
-- =============================================

-- 3. Examiner les conditions spécifiques des politiques problématiques
WITH policy_details AS (
    SELECT 
        pol.polname,
        pol.polcmd,
        pol.polpermissive,
        pg_get_expr(pol.polqual, pol.polrelid) as condition_text,
        unnest(pol.polroles::oid[]) as role_oid
    FROM pg_policy pol
    JOIN pg_class cls ON pol.polrelid = cls.oid
    WHERE cls.relname = 'user_roles'
    AND pol.polcmd = 'r'
)
SELECT 
    pd.polname,
    r.rolname as role_name,
    pd.condition_text,
    CASE 
        WHEN pd.condition_text ILIKE '%can_view_user_roles%' THEN 'VIEW_PERMISSION'
        WHEN pd.condition_text ILIKE '%can_manage_user_roles%' THEN 'MANAGE_PERMISSION'
        ELSE 'OTHER'
    END as permission_type
FROM policy_details pd
LEFT JOIN pg_roles r ON r.oid = pd.role_oid
ORDER BY r.rolname, pd.polname;

-- =============================================
-- PHASE 3: RECOMMANDATIONS D'OPTIMISATION
-- =============================================

-- 4. Proposition de consolidation des politiques
-- Analyser si les politiques peuvent être fusionnées

-- Option 1: Politique unifiée avec OR logic
-- Au lieu d'avoir deux politiques séparées:
-- - "Users can view user roles if authorized" 
-- - "Users can manage user roles if authorized"
-- 
-- Créer une seule politique:

/*
-- PROPOSITION DE NOUVELLE POLITIQUE CONSOLIDÉE
CREATE POLICY "Users can access user roles if authorized" 
ON public.user_roles
FOR SELECT 
USING (
    public.can_view_user_roles(auth.uid()) OR 
    public.can_manage_user_roles(auth.uid())
);
*/

-- =============================================
-- PHASE 4: PLAN DE MIGRATION DES POLITIQUES
-- =============================================

-- 5. Script de migration (À EXÉCUTER AVEC PRÉCAUTION)

-- Étape 1: Sauvegarder les politiques existantes
CREATE TABLE IF NOT EXISTS policy_backup AS
SELECT 
    'user_roles' as table_name,
    pol.polname as policy_name,
    pol.polcmd as command_type,
    pol.polpermissive as is_permissive,
    pol.polroles as role_oids,
    pg_get_expr(pol.polqual, pol.polrelid) as policy_condition,
    now() as backup_date
FROM pg_policy pol
JOIN pg_class cls ON pol.polrelid = cls.oid
WHERE cls.relname = 'user_roles';

-- Étape 2: Supprimer les anciennes politiques (DÉCOMMENTER POUR EXÉCUTER)
/*
DROP POLICY IF EXISTS "Users can view user roles if authorized" ON public.user_roles;
DROP POLICY IF EXISTS "Users can manage user roles if authorized" ON public.user_roles;
*/

-- Étape 3: Créer la nouvelle politique consolidée (DÉCOMMENTER POUR EXÉCUTER)
/*
CREATE POLICY "Users can access user roles if authorized" 
ON public.user_roles
FOR SELECT 
USING (
    public.can_view_user_roles(auth.uid()) OR 
    public.can_manage_user_roles(auth.uid())
);
*/

-- =============================================
-- PHASE 5: TESTS DE VALIDATION
-- =============================================

-- 6. Tester les performances avant/après

-- Test de performance pour les politiques multiples (AVANT)
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM public.user_roles 
WHERE user_id = auth.uid() 
LIMIT 10;

-- 7. Vérifier l'accès après consolidation
-- Ces requêtes doivent fonctionner après la migration

-- Test d'accès pour un utilisateur avec permission de vue
-- SET LOCAL role = 'authenticated';
-- SELECT COUNT(*) FROM public.user_roles;

-- Test d'accès pour un utilisateur avec permission de gestion  
-- SET LOCAL role = 'authenticated';
-- SELECT * FROM public.user_roles WHERE workspace_id = 'test-workspace';

-- =============================================
-- PHASE 6: MONITORING POST-MIGRATION
-- =============================================

-- 8. Requêtes de monitoring des performances RLS

-- Surveiller les statistiques d'accès aux tables avec RLS
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins,
    n_tup_upd,
    n_tup_del
FROM pg_stat_user_tables 
WHERE tablename = 'user_roles';

-- Surveiller les temps d'exécution des requêtes avec politiques RLS
-- (Nécessite pg_stat_statements activé)
/*
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
WHERE query ILIKE '%user_roles%'
ORDER BY mean_time DESC
LIMIT 10;
*/

-- =============================================
-- ROLLBACK EN CAS DE PROBLÈME
-- =============================================

-- 9. Script de rollback pour restaurer les anciennes politiques

/*
-- En cas de problème, restaurer les politiques originales:

-- Supprimer la nouvelle politique
DROP POLICY IF EXISTS "Users can access user roles if authorized" ON public.user_roles;

-- Recréer les anciennes politiques (adapter selon vos politiques exactes)
CREATE POLICY "Users can view user roles if authorized" 
ON public.user_roles
FOR SELECT 
USING (public.can_view_user_roles(auth.uid()));

CREATE POLICY "Users can manage user roles if authorized" 
ON public.user_roles
FOR SELECT 
USING (public.can_manage_user_roles(auth.uid()));
*/

-- =============================================
-- NOTES ET RECOMMANDATIONS
-- =============================================

/*
RECOMMANDATIONS POUR L'OPTIMISATION DES POLITIQUES RLS:

1. **Analyse préliminaire**:
   - Identifier les politiques qui se chevauchent
   - Vérifier si les conditions peuvent être fusionnées
   - Mesurer les performances actuelles

2. **Stratégies de consolidation**:
   - Fusionner les politiques avec des conditions OR/AND logiques
   - Simplifier les expressions complexes
   - Utiliser des fonctions optimisées

3. **Test et validation**:
   - Tester avec différents types d'utilisateurs
   - Vérifier que les permissions restent correctes
   - Mesurer l'amélioration des performances

4. **Monitoring continu**:
   - Surveiller les métriques de performance
   - Analyser les logs d'accès
   - Ajuster si nécessaire

5. **Alternatives à considérer**:
   - Utiliser des vues au lieu de politiques RLS complexes
   - Implémenter la logique d'autorisation au niveau application
   - Créer des index optimisés pour les conditions RLS
*/



