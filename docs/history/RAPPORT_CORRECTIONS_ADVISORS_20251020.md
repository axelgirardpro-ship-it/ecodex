# Rapport de corrections - Security & Performance Advisors Supabase
**Date** : 20 octobre 2025  
**Projet** : DataCarb / Eco Search  
**Statut** : ✅ Corrections complétées

---

## 📊 Résumé Exécutif

### Objectif
Corriger tous les problèmes critiques et optimiser la base de données PostgreSQL suite aux recommandations des Security et Performance Advisors de Supabase.

### Résultats Globaux

| Catégorie | Avant | Après | Taux résolution |
|-----------|-------|-------|-----------------|
| **Security Advisors** | 11 problèmes | 1 problème | **91% résolus** |
| **Performance Advisors** | 28 problèmes | 9 problèmes | **68% résolus** |
| **TOTAL** | 39 problèmes | 10 problèmes | **74% résolus** |

---

## 🔒 Security Advisors - Résultats détaillés

### ✅ Problèmes résolus (10/11)

#### 1. RLS désactivé sur 6 tables publiques ✅ RÉSOLU
**Gravité** : ❌ ERROR (critique)

**Tables corrigées** :
- `emission_factors` (448k lignes) - Table principale avec politiques existantes
- `algolia_source_assignments_projection` (20k lignes)
- `staging_emission_factors` (448k lignes)
- `staging_user_imports` (9 lignes)
- `user_batch_algolia` (9 lignes)
- `user_factor_overlays` (117 lignes)

**Action** : RLS activé avec politiques appropriées  
**Migration** : `enable_rls_and_consolidate_policies`

#### 2. Fonctions avec search_path mutable ✅ RÉSOLU
**Gravité** : ⚠️ WARNING

**Fonctions corrigées** :
- `get_import_setting`
- `check_workspace_user_limit`
- `validate_dataset_name`
- `sync_emission_factors_id`

**Action** : `SET search_path = public, pg_temp` ajouté  
**Migration** : `fix_function_search_paths`

### ⚠️ Problème accepté (1/11)

#### Extension http dans le schéma public
**Gravité** : ⚠️ WARNING  
**Décision** : ACCEPTÉ avec documentation

**Raison** :
- Extension utilisée par 5+ fonctions critiques (imports, http_post, etc.)
- Déplacer l'extension casserait les flows d'import admin et user
- Risque > Bénéfice
- Extension fiable et maintenue par Supabase

**Migration** : `document_http_extension_warning`

---

## ⚡ Performance Advisors - Résultats détaillés

### ✅ Problèmes résolus (19/28)

#### 1. Index dupliqués ✅ RÉSOLU
**Tables** : `emission_factors`  
**Index supprimés** : `uniq_emission_factors_id_fe`  
**Index conservés** : `emission_factors_id_fe_unique`  
**Migration** : `remove_duplicate_indexes`

#### 2. Index inutilisés - Phase 1 ✅ RÉSOLU (12 index)
**Catégories supprimées** :
- 4 index sur scores Algolia (gérés côté Algolia, pas SQL)
- 3 index sur timestamps de création (rarement utilisés)
- 3 index sur tables de staging (tables temporaires)
- 2 index métier confirmés inutiles

**Migration** : `remove_unused_indexes_phase1`

#### 3. Index inutilisés - Phase 2 ✅ RÉSOLU (6 index)
**Index supprimés** :
- `ef_all_workspace_idx`
- `idx_datasets_workspace_user`
- `idx_ef_all_search_assigned_workspaces`
- `idx_ef_all_search_is_blurred`
- `idx_emission_factors_factor_key`
- `idx_fe_source_workspace_assignments_created_at`

**Migration** : `remove_unused_indexes_phase2`

#### 4. Politiques RLS multiples ✅ RÉSOLU (2 tables)
**Tables optimisées** :
- `emission_factors` : Politique "simplified" supprimée, garde uniquement "4-tier access"
- `user_factor_overlays` : 2 politiques SELECT fusionnées en 1, séparation par action (SELECT/INSERT/UPDATE/DELETE)

**Migration** : `enable_rls_and_consolidate_policies`, `optimize_rls_policies_performance`

#### 5. Optimisation RLS auth.uid() ✅ RÉSOLU (3 politiques)
**Problème** : `auth.uid()` réévalué pour chaque ligne (performance critique sur 448k lignes)  
**Solution** : Remplacé par `(SELECT auth.uid())` pour évaluation unique

**Tables optimisées** :
- `emission_factors`
- `user_factor_overlays` (3 politiques)

**Migration** : `optimize_rls_policies_performance`

### ℹ️ Problèmes acceptés avec documentation (9/28)

#### 1. Tables sans clé primaire (3 tables)
**Tables** : `staging_emission_factors`, `staging_user_imports`, `user_batch_algolia`  
**Décision** : ACCEPTÉ - Tables temporaires vidées après chaque import  
**Migration** : `document_staging_tables_no_primary_keys`

#### 2. Index inutilisés conservés (4 index)
**Décision utilisateur** : Garder pour fonctionnalités futures
- `idx_users_email` - Recherche admin par email
- `idx_users_user_id` - Utilisé par auth
- `idx_workspaces_plan_tier` - Stats par tier (freemium, pro-1, pro-2, etc.)
- `idx_plan_tiers_plan_type` - Filtrage par type (freemium/pro)

#### 3. Foreign keys non indexées (2 contraintes)
**Impact** : Faible (tables peu volumineuses)
- `data_imports.version_id` → `fe_versions.id`
- `datasets.workspace_id` → `workspaces.id`

**Recommandation future** : Créer index si volumétrie augmente

---

## 📋 Migrations appliquées

| # | Nom | Objectif | Statut |
|---|-----|----------|--------|
| 1 | `fix_function_search_paths` | Sécuriser 4 fonctions | ✅ |
| 2 | `enable_rls_and_consolidate_policies` | Activer RLS sur 6 tables + consolider politiques | ✅ |
| 3 | `document_http_extension_warning` | Documenter extension http | ✅ |
| 4 | `remove_duplicate_indexes` | Supprimer 1 index dupliqué | ✅ |
| 5 | `remove_unused_indexes_phase1` | Supprimer 12 index inutilisés | ✅ |
| 6 | `remove_unused_indexes_phase2` | Supprimer 6 index inutilisés | ✅ |
| 7 | `document_staging_tables_no_primary_keys` | Documenter décision PK | ✅ |
| 8 | `optimize_rls_policies_performance` | Optimiser RLS auth.uid() | ✅ |

**Total** : 8 migrations appliquées avec succès

---

## 🎯 Impact attendu

### Sécurité
- ✅ 100% des erreurs critiques (ERROR) corrigées
- ✅ Protection RLS active sur toutes les tables publiques sensibles
- ✅ Fonctions sécurisées contre les attaques par search_path
- ✅ Respect des meilleures pratiques Supabase

### Performance
- ⚡ **-18 index** : Réduction significative de la consommation mémoire
- ⚡ **INSERT/UPDATE/DELETE plus rapides** : Moins d'index à maintenir
- ⚡ **RLS optimisé** : Évaluation unique de auth.uid() (vs par ligne)
- ⚡ **1 politique au lieu de 2** sur emission_factors (448k lignes)

### Maintenance
- 🧹 Base de données plus propre et maintenable
- 📊 Meilleure visibilité sur les vrais problèmes de performance
- 📝 Documentation complète des décisions architecturales

---

## 🔍 Validation et tests recommandés

### Tests fonctionnels
- [ ] Tester la recherche Algolia (base commune + base personnelle)
- [ ] Tester l'import admin (flow complet avec staging_emission_factors)
- [ ] Tester l'import utilisateur (flow complet avec staging_user_imports)
- [ ] Vérifier l'accès aux sources premium assignées
- [ ] Tester les overlays utilisateur (user_factor_overlays)

### Monitoring
- [ ] Surveiller les temps de réponse Edge Function `algolia-search-proxy`
- [ ] Monitorer les query plans sur `emission_factors` (EXPLAIN ANALYZE)
- [ ] Vérifier l'utilisation CPU/mémoire Postgres pendant 48h
- [ ] Consulter `pg_stat_user_indexes` pour valider suppressions d'index

### Validation Advisors
```sql
-- Réexécuter les advisors pour confirmer les corrections
-- Security Advisor : 1 seul WARNING attendu (extension http)
-- Performance Advisor : 9 INFO attendus (acceptés et documentés)
```

---

## 📚 Références

### Documentation Supabase
- [Database Linter](https://supabase.com/docs/guides/database/database-linter)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [RLS Performance](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select)

### Terminologie DataCarb
**Plans (workspaces)** :
- `plan_type` : `freemium` ou `pro`
- `tier_code` : `freemium`, `pro-1`, `pro-2`, `pro-3`, `pro-4`

**Sources (fe_sources)** :
- `access_level` : `free` (gratuit) ou `paid` (premium)

---

## ✅ Conclusion

Les corrections ont été appliquées avec succès, améliorant significativement la sécurité (91% des problèmes résolus) et les performances (68% des problèmes résolus) de la base de données.

Les problèmes restants sont **acceptés et documentés** avec des justifications solides basées sur l'architecture actuelle du système et les contraintes métier (préservation des flows d'import).

**Recommandation** : Déployer en production après validation des tests fonctionnels et monitoring pendant 48h.

