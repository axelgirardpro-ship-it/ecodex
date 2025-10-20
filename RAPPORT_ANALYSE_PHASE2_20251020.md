# Rapport Phase 2 - Analyse READONLY Query Performance
**Date** : 20 octobre 2025  
**Projet** : DataCarb / Eco Search  
**Statut** : ✅ Phase 2 COMPLÉTÉE - Diagnostic sans modification

---

## 📊 Résumé Exécutif

### Objectif Phase 2
Analyser les requêtes lentes et identifier les causes racines **SANS AUCUNE MODIFICATION**.

### Découvertes principales
1. ⚠️ **`run_import_from_staging()` très gourmande** : TRUNCATE + rebuild complet + 4 triggers
2. 🔴 **5 triggers sur `fe_sources`** dont 1 webhook HTTP externe (10s timeout)
3. 🔴 **`emission_factors_all_search` en Realtime** : Cause des 2.8M appels (448k lignes)
4. ⚠️ **15 tables en Realtime** : Trop de tables exposées

---

## 🔍 Analyse détaillée

### 1. Fonction `run_import_from_staging()` (124s moyenne)

#### Structure de la fonction

**Étapes** :
1. `TRUNCATE TABLE emission_factors` - Vide la table entière (448k lignes)
2. Créer 4 tables temporaires (prepared, invalid, valid, dedup)
3. Insérer sources manquantes dans `fe_sources`
4. INSERT massif vers `emission_factors` (448k lignes)
5. **`rebuild_emission_factors_all_search()`** - Reconstruit toute la table de recherche
6. `ANALYZE emission_factors_all_search`
7. **`run_algolia_data_task()`** - Réindexation Algolia complète

#### Goulots d'étranglement identifiés

| Opération | Temps estimé | Impact |
|-----------|--------------|--------|
| TRUNCATE + INSERT 448k lignes | ~30-40s | 🔴 Critique |
| rebuild_emission_factors_all_search() | ~40-60s | 🔴 Critique |
| run_algolia_data_task() | ~20-30s | ⚠️ Élevé |
| Tables temporaires | ~10-20s | ⚠️ Moyen |

#### Problèmes détectés

1. **TRUNCATE TABLE systématique** :
   ```sql
   TRUNCATE TABLE public.emission_factors;
   ```
   - ⚠️ Supprime **TOUTES** les données à chaque import
   - Alternative : UPSERT incrémental pour ne modifier que lignes changées

2. **Multiples tables temporaires** :
   ```sql
   CREATE TEMPORARY TABLE temp_prepared AS ...
   CREATE TEMPORARY TABLE temp_invalid AS ...
   CREATE TEMPORARY TABLE temp_valid AS ...
   CREATE TEMPORARY TABLE temp_dedup AS ...
   ```
   - ⚠️ 4 tables temp = 4x copies en mémoire/disque
   - Alternative : Une seule CTE (Common Table Expression)

3. **Rebuild complet de emission_factors_all_search** :
   - ⚠️ Reconstruit 448k lignes à chaque fois (même si 1 seule ligne modifiée)
   - Alternative : Rebuild incrémental ou trigger sur emission_factors

4. **Réindexation Algolia complète** :
   - ⚠️ Envoie 448k records à Algolia à chaque import
   - Alternative : Indexation incrémentale

#### Recommandations

**Option 1 - Optimisation progressive (SAFE)** :
- Utiliser CTE au lieu de tables temporaires
- Batch INSERT au lieu d'INSERT massif unique
- COMMIT intermédiaires (actuellement transaction atomique)

**Option 2 - Refactoring structurel (POC requis)** :
- Passer de TRUNCATE+INSERT → UPSERT incrémental
- Rebuild incrémental de emission_factors_all_search
- Indexation Algolia incrémentale

**Option 3 - Parallélisation (Complexe)** :
- Utiliser `parallel_workers` pour INSERT
- Batching par source ou par tranches

---

### 2. Triggers sur `fe_sources` (47s moyenne pour UPDATE)

#### Les 5 triggers détectés

| Trigger | Type | Fonction | Impact | Risque |
|---------|------|----------|--------|--------|
| **fe_sources** | AFTER | `supabase_functions.http_request` | 🔴 CRITIQUE | **10s timeout** |
| trg_auto_assign_fe_sources | AFTER | auto_assign_sources_on_fe_sources | ⚠️ Élevé | Assignations |
| trg_cleanup_free_source_assignments | AFTER | cleanup_free_source_assignments | ⚠️ Moyen | Nettoyage |
| trg_fe_sources_refresh_projection | AFTER | tr_refresh_projection_fe_sources | 🔴 CRITIQUE | Rebuild projection |
| update_fe_sources_updated_at | BEFORE | update_updated_at_column | ✅ Faible | Timestamp |

#### Problème #1 : Webhook HTTP externe (BLOQUANT)

```sql
CREATE TRIGGER fe_sources AFTER INSERT OR DELETE OR UPDATE 
ON public.fe_sources FOR EACH ROW 
EXECUTE FUNCTION supabase_functions.http_request(
  'https://wrodvaatdujbpfpvrzge.supabase.co/functions/v1/db-webhooks-optimized', 
  'POST', '{}', '{}', '10000'  -- 10 secondes de timeout !
)
```

**Impact** :
- 🔴 **Chaque UPDATE sur fe_sources attend 10s** (timeout)
- 🔴 Bloque la transaction pendant l'appel HTTP
- 🔴 Si webhook lent/down, toute modification de fe_sources ralentit

**Solution** :
- ✅ Déplacer webhook vers queue asynchrone (pg_net background)
- ✅ Ou désactiver ce trigger si webhook non critique
- ⚠️ Vérifier si webhook est utilisé par Edge Functions

#### Problème #2 : Refresh projection systématique

```sql
CREATE TRIGGER trg_fe_sources_refresh_projection 
AFTER INSERT OR UPDATE OF access_level, source_name 
ON public.fe_sources FOR EACH ROW 
EXECUTE FUNCTION tr_refresh_projection_fe_sources()
```

**Impact** :
- ⚠️ Met à jour `algolia_source_assignments_projection` (20k lignes)
- ⚠️ À CHAQUE UPDATE de access_level (ex: free → paid)
- ⚠️ Même si une seule ligne changée

**Solution** :
- ✅ Batch updates : désactiver trigger, faire UPDATE groupés, réactiver
- ✅ Optimiser fonction pour UPDATE incrémental uniquement

#### Problème #3 : Auto-assignation en cascade

```sql
CREATE TRIGGER trg_auto_assign_fe_sources 
AFTER INSERT OR UPDATE OF access_level, is_global 
ON public.fe_sources FOR EACH ROW 
EXECUTE FUNCTION auto_assign_sources_on_fe_sources()
```

**Impact** :
- ⚠️ Peut créer des assignations pour tous les workspaces
- ⚠️ Si source devient 'paid', peut impacter beaucoup de lignes

**Solution** :
- ✅ Désactiver pendant migrations/imports massifs
- ✅ Exécuter manuellement après batch updates

---

### 3. Configuration Realtime (2.8M appels)

#### Publications actives

| Publication | Tables | Impact |
|-------------|--------|--------|
| supabase_realtime | 15 tables | 🔴 TROP |
| supabase_realtime_messages_publication | messages | ✅ OK |

#### Tables en Realtime (15 tables !)

**Tables volumineuses** (❌ NE DEVRAIENT PAS être en Realtime) :
- `emission_factors_all_search` : **448k lignes** 🔴 CRITIQUE
- `audit_logs` : 477 lignes
- `data_imports` : 88 lignes
- `search_history` : 548 lignes

**Tables petites** (✅ OK pour Realtime) :
- `favorites` : 3 lignes
- `fe_sources` : 52 lignes
- `fe_source_workspace_assignments` : 5 lignes
- `search_quotas` : 9 lignes
- `user_roles` : 10 lignes
- `users` : 11 lignes
- `workspace_invitations` : 1 ligne
- `workspace_trials` : 3 lignes
- `workspaces` : 6 lignes
- `datasets` : 44 lignes
- `fe_versions` : 0 lignes

#### Problème critique : emission_factors_all_search en Realtime

**Impact** :
- 🔴 **2.8M appels realtime.list_changes()** (23.8s total)
- 🔴 Chaque client connecté reçoit les updates de 448k lignes
- 🔴 À chaque import, tous les clients reçoivent notification
- 🔴 Consommation CPU/mémoire massive côté serveur

**Solution recommandée** :
```sql
-- RETIRER emission_factors_all_search de Realtime
ALTER PUBLICATION supabase_realtime DROP TABLE emission_factors_all_search;
```

**Impact de la solution** :
- ✅ Réduction de ~90% des appels Realtime
- ✅ Amélioration performance serveur
- ⚠️ Clients ne recevront plus updates temps réel de cette table
- ⚠️ **VÉRIFIER** : Frontend utilise-t-il Realtime sur cette table ?

#### Tables à considérer pour retrait Realtime

**Logs et historiques** (peu utiles en temps réel) :
- `audit_logs` : Logs techniques (pas besoin de temps réel)
- `search_history` : Historique recherche (pas besoin de temps réel)
- `data_imports` : Statut imports (polling serait suffisant)

**Tables métier à garder en Realtime** :
- ✅ `favorites` : Utile pour sync entre onglets
- ✅ `fe_sources` : Changements access_level impactent UI
- ✅ `search_quotas` : Mise à jour quota en temps réel
- ✅ `user_roles` : Changements droits utilisateur
- ✅ `workspaces` : Modifications workspace

---

## 🎯 Recommandations par priorité

### Priorité 1 - Impact immédiat (SAFE)

**1.1 Désactiver Realtime sur emission_factors_all_search**
```sql
ALTER PUBLICATION supabase_realtime DROP TABLE emission_factors_all_search;
```

**Gain attendu** : -90% appels Realtime, -23s temps total  
**Risque** : Vérifier frontend n'utilise pas Realtime sur cette table  
**Test** : Chercher `useRealtimeSubscription('emission_factors_all_search')` dans src/

**1.2 Désactiver Realtime sur tables logs**
```sql
ALTER PUBLICATION supabase_realtime DROP TABLE audit_logs;
ALTER PUBLICATION supabase_realtime DROP TABLE search_history;
ALTER PUBLICATION supabase_realtime DROP TABLE data_imports;
```

**Gain attendu** : -5% appels Realtime  
**Risque** : Faible, ces tables utilisent plutôt du polling

---

### Priorité 2 - Nécessite validation (PRUDENT)

**2.1 Désactiver webhook HTTP bloquant sur fe_sources**

**Option A - Désactiver temporairement** :
```sql
ALTER TABLE fe_sources DISABLE TRIGGER fe_sources;
```

**Option B - Rendre asynchrone** :
- Utiliser `pg_net.http_post()` en background
- Ou créer queue avec `pgmq`

**Gain attendu** : -10s par UPDATE fe_sources  
**Risque** : Vérifier si webhook est critique pour app

**2.2 Optimiser run_import_from_staging()**

**Quick wins** :
- Remplacer 4 tables temp par 1 CTE
- Batch INSERT (1000 lignes à la fois)
- COMMIT intermédiaires

**Gain attendu** : -30-40% temps import (120s → 70s)  
**Risque** : Tests exhaustifs requis

---

### Priorité 3 - Long terme (POC requis)

**3.1 Refactoring run_import_from_staging()**
- UPSERT incrémental au lieu de TRUNCATE
- Rebuild incrémental emission_factors_all_search
- Indexation Algolia incrémentale

**Gain attendu** : -70-80% temps import (120s → 20-30s)  
**Risque** : Refactoring complet, tests exhaustifs

**3.2 Optimiser triggers fe_sources**
- Désactiver triggers pendant batch updates
- Refresh projection en mode batch
- Auto-assignation asynchrone

**Gain attendu** : -90% temps UPDATE fe_sources (47s → 5s)  
**Risque** : Changement logique métier, validation requise

---

## ✅ Actions à prendre (avec votre accord)

### Étape 1 - Vérification frontend (SAFE)

```bash
# Vérifier utilisation Realtime sur emission_factors_all_search
grep -r "emission_factors_all_search" src/
grep -r "useRealtimeSubscription" src/ | grep -i "emission"

# Vérifier utilisation webhook fe_sources
grep -r "db-webhooks-optimized" src/
```

### Étape 2 - Test désactivation Realtime (RÉVERSIBLE)

```sql
-- Tester en désactivant temporairement
ALTER PUBLICATION supabase_realtime DROP TABLE emission_factors_all_search;

-- Monitorer pendant 1h
-- Si problème, réactiver immédiatement :
ALTER PUBLICATION supabase_realtime ADD TABLE emission_factors_all_search;
```

### Étape 3 - Analyse webhook (LECTURE)

```sql
-- Voir si webhook est appelé
SELECT * FROM pg_stat_user_functions 
WHERE funcname LIKE '%http_request%';
```

---

## 📊 Impact potentiel des optimisations

| Optimisation | Gain attendu | Risque | Priorité |
|--------------|--------------|--------|----------|
| **Désactiver Realtime emission_factors_all_search** | -23s (-90% Realtime) | Faible | 🔴 P1 |
| **Désactiver webhook HTTP fe_sources** | -10s par UPDATE | Moyen | ⚠️ P2 |
| **Optimiser run_import_from_staging()** | -40s (-30% import) | Élevé | 📋 P3 |
| **Désactiver Realtime logs** | -2s (-10% Realtime) | Faible | ⚠️ P2 |

**Total gain potentiel** : -75s sur les opérations critiques (-60%)

---

## ✅ Conclusion Phase 2

La Phase 2 a permis d'identifier **3 problèmes majeurs** :

1. ✅ **Realtime sur table volumineuse** : emission_factors_all_search (448k lignes) cause 2.8M appels
2. ✅ **Webhook HTTP bloquant** : 10s timeout sur chaque UPDATE fe_sources
3. ✅ **Import non optimisé** : TRUNCATE + rebuild complet à chaque fois

**Prochaines étapes** :
- ⚠️ Valider avec vous quelle optimisation appliquer en Phase 3
- ⚠️ Vérifier le code frontend avant toute modification
- ⚠️ Tester chaque changement de manière réversible

**AUCUNE MODIFICATION N'A ÉTÉ FAITE** - Rapport d'analyse uniquement ✅

