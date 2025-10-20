# Rapport Phase 1 - Optimisations Query Performance
**Date** : 20 octobre 2025  
**Projet** : DataCarb / Eco Search  
**Statut** : ✅ Phase 1 COMPLÉTÉE avec succès

---

## 📊 Résumé Exécutif

### Objectif Phase 1
Appliquer les optimisations **100% SAFE** (zéro impact utilisateur) identifiées par l'analyse Query Performance de Supabase.

### Résultats
- ✅ **4 tables nettoyées** : VACUUM ANALYZE éliminé 100% des dead rows
- ✅ **4 index créés** : CREATE INDEX CONCURRENTLY sans aucun lock
- ✅ **Durée totale** : ~15 minutes
- ✅ **Impact utilisateur** : ZÉRO (opérations en arrière-plan)

---

## 🎯 Problèmes identifiés et résolus

### 1. Dead rows massifs (75-93% de données mortes)

| Table | Live Rows | Dead Rows Avant | % Dead Avant | Dead Rows Après | % Dead Après |
|-------|-----------|-----------------|--------------|-----------------|--------------|
| **user_roles** | 10 | 35 | 77.78% | 0 | 0% |
| **favorites** | 3 | 6 | 66.67% | 0 | 0% |
| **workspace_invitations** | 1 | 15 | 93.75% | 0 | 0% |
| **fe_source_workspace_assignments** | 5 | 19 | 79.17% | 0 | 0% |

**Solution appliquée** :
```sql
VACUUM ANALYZE public.user_roles;
VACUUM ANALYZE public.favorites;
VACUUM ANALYZE public.workspace_invitations;
VACUUM ANALYZE public.fe_source_workspace_assignments;
```

**Résultat** : 
- ✅ 75 dead rows nettoyées (100% supprimées)
- ✅ Espace récupéré et disponible pour réutilisation
- ✅ Statistiques query planner mises à jour

### 2. Scans séquentiels massifs au lieu d'index

**Problème détecté** : Tables scannées en totalité au lieu d'utiliser des index

| Table | Scans Séq. | Lignes lues | % Sequential |
|-------|------------|-------------|--------------|
| **user_roles** | 753,000 | 5.7M | 99.9% |
| **users** | 10,300 | 96k | 99.5% |
| **favorites** | 1,700 | 5k | 100% |

**Cause** : Politiques RLS font des JOIN sans index sur colonnes de jointure

**Solution appliquée** :
```sql
-- Index 1: Optimise JOIN RLS sur user_roles
CREATE INDEX CONCURRENTLY idx_user_roles_workspace_user
ON user_roles(workspace_id, user_id)
WHERE workspace_id IS NOT NULL;

-- Index 2: Optimise requêtes par user_id seul
CREATE INDEX CONCURRENTLY idx_user_roles_user_id
ON user_roles(user_id);

-- Index 3: Optimise JOIN users → workspaces
CREATE INDEX CONCURRENTLY idx_users_workspace_id
ON users(workspace_id);

-- Index 4: Élimine 100% scans séquentiels sur favorites
CREATE INDEX CONCURRENTLY idx_favorites_user_item
ON favorites(user_id, item_type, item_id);
```

**Résultat** :
- ✅ 4 index créés (16 kB chacun)
- ✅ Création CONCURRENTLY (pas de lock, zéro impact)
- ✅ Réduction attendue : -99.9% des scans séquentiels

---

## 📈 Impact attendu

### Performance queries
- **user_roles** : 753k scans → < 100 scans (-99.9%)
- **users** : 10.3k scans → < 50 scans (-99.5%)
- **favorites** : 1.7k scans → 0 scans (-100%)

### Performance globale
- Politiques RLS plus rapides (JOIN optimisés avec index)
- Requêtes authentifiées plus rapides (moins de scans)
- Meilleur cache hit ratio (données plus compactes après VACUUM)

### Maintenance
- Autovacuum plus efficace (statistiques à jour)
- Moins d'espace disque gaspillé
- Meilleur planning des requêtes futures

---

## 🔒 Garanties de sécurité respectées

### Opérations SAFE appliquées
✅ **VACUUM ANALYZE** :
- Pas de lock exclusif
- Opération en arrière-plan
- Annulable à tout moment
- Améliore uniquement les performances

✅ **CREATE INDEX CONCURRENTLY** :
- Pas de lock pendant création
- Construction en parallèle des requêtes
- Si échec, index INVALID (DROP et recommencer)
- Impact CPU temporaire uniquement

### Vérifications effectuées
✅ Aucun impact sur Edge Functions  
✅ Aucun impact sur frontend  
✅ Aucun impact sur imports admin/user  
✅ Aucun lock détecté  

---

## 📋 Phases suivantes (non exécutées)

### Phase 2 - Analyse READONLY (à venir)
**Objectif** : Diagnostic sans modification
- Analyser `run_import_from_staging()` avec EXPLAIN
- Identifier triggers sur `fe_sources`
- Vérifier configuration Realtime

### Phase 3 - Optimisations prudentes (validation requise)
**Objectif** : Optimisations nécessitant validation
- Configurer autovacuum plus agressif (test sur `favorites` d'abord)
- Révoquer accès PostgREST aux staging tables (vérifier code frontend)

### Phase 4 - Propositions long terme (POC requis)
**Objectif** : Optimisations structurelles
- Optimiser `run_import_from_staging()`
- Optimiser triggers `fe_sources`
- Configurer Realtime
- Partitionnement `emission_factors`

---

## ✅ Validation des résultats

### Dead rows nettoyés
```
favorites                        : 0 dead rows (était 66.67%)
fe_source_workspace_assignments  : 0 dead rows (était 79.17%)
user_roles                       : 0 dead rows (était 77.78%)
workspace_invitations            : 0 dead rows (était 93.75%)
```

### Index créés
```
idx_favorites_user_item          : 16 kB (favorites)
idx_user_roles_user_id           : 16 kB (user_roles)
idx_user_roles_workspace_user    : 16 kB (user_roles)
idx_users_workspace_id           : 16 kB (users)
```

### Timestamps VACUUM
```
favorites                        : 2025-10-20 12:32:07 UTC
fe_source_workspace_assignments  : 2025-10-20 12:32:08 UTC
user_roles                       : 2025-10-20 12:32:06 UTC
workspace_invitations            : 2025-10-20 12:32:08 UTC
```

---

## 🎓 Explications techniques

### Qu'est-ce qu'un "dead row" ?
Une **dead row** (ligne morte) est une ligne obsolète après UPDATE/DELETE qui occupe de l'espace sans être visible.

**Exemple** :
```sql
UPDATE user_roles SET role = 'admin' WHERE id = 1;
-- Crée : 1 dead row (ancienne version) + 1 live row (nouvelle)
```

**Impact** : Ralentit les requêtes + gaspille l'espace disque

### Qu'est-ce que VACUUM ?
**VACUUM** nettoie les dead rows et récupère l'espace pour réutilisation.

**VACUUM ANALYZE** fait 2 choses :
1. Nettoie les dead rows
2. Met à jour les statistiques pour le query planner

**Totalement SAFE** : Pas de lock, opération en arrière-plan

### Qu'est-ce que CREATE INDEX CONCURRENTLY ?
Crée un index **sans bloquer** les requêtes en cours.

**Différence vs CREATE INDEX normal** :
- CREATE INDEX : Lock exclusif (bloque INSERT/UPDATE/DELETE)
- CREATE INDEX CONCURRENTLY : Pas de lock (construction en parallèle)

**Parfait pour la production** car zéro impact utilisateur

---

## 📝 Migrations appliquées

| # | Nom | Type | Statut |
|---|-----|------|--------|
| 1 | VACUUM user_roles | execute_sql | ✅ |
| 2 | VACUUM favorites | execute_sql | ✅ |
| 3 | VACUUM workspace_invitations | execute_sql | ✅ |
| 4 | VACUUM fe_source_workspace_assignments | execute_sql | ✅ |
| 5 | CREATE INDEX idx_user_roles_workspace_user | execute_sql | ✅ |
| 6 | CREATE INDEX idx_user_roles_user_id | execute_sql | ✅ |
| 7 | CREATE INDEX idx_users_workspace_id | execute_sql | ✅ |
| 8 | CREATE INDEX idx_favorites_user_item | execute_sql | ✅ |
| 9 | document_query_performance_phase1 | migration | ✅ |

**Total** : 9 opérations appliquées avec succès

---

## 🔍 Monitoring recommandé

### Après 24h
```sql
-- Vérifier que les index sont utilisés
SELECT 
  schemaname, 
  relname as table_name,
  indexrelname as index_name, 
  idx_scan as times_used,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE indexrelname LIKE 'idx_user_roles%'
   OR indexrelname LIKE 'idx_users_workspace%'
   OR indexrelname LIKE 'idx_favorites%'
ORDER BY idx_scan DESC;
```

### Après 48h
```sql
-- Vérifier réduction des scans séquentiels
SELECT 
  relname as table_name,
  seq_scan as sequential_scans,
  seq_tup_read as rows_read_seq,
  idx_scan as index_scans,
  idx_tup_fetch as rows_fetched_idx,
  ROUND(100.0 * seq_tup_read / NULLIF(seq_tup_read + idx_tup_fetch, 0), 2) as pct_sequential
FROM pg_stat_user_tables
WHERE relname IN ('user_roles', 'users', 'favorites', 'workspaces')
ORDER BY seq_tup_read DESC;
```

---

## ✅ Conclusion

La Phase 1 des optimisations Query Performance a été **complétée avec succès** :

✅ **75 dead rows nettoyées** (100% éliminées)  
✅ **4 index critiques créés** (optimisation JOIN RLS)  
✅ **Zéro impact utilisateur** (opérations SAFE uniquement)  
✅ **Amélioration attendue** : -99% scans séquentiels  

**Recommandation** : Monitorer pendant 48h, puis procéder aux Phases 2-3 après validation.

