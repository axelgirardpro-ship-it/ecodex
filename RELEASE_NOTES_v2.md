# Release Notes - Feature/Paid-Source-Locks → Main

## 📊 Statistiques

- **23 commits en retard** sur la branche `main`
- **564 fichiers modifiés** (+34,429 lignes, -1,987 lignes)
- **Période** : Depuis la dernière release sur main

## 🐛 Corrections critiques

### 1. Bug d'affichage du plan et accès aux favoris (PR #111) 🔴 CRITIQUE
**Commit** : `522cbe84` - fix: Correction de l'affichage du plan utilisateur et de l'accès aux favoris

**Impact** : Tous les utilisateurs Pro
- ❌ **Avant** : Plan affiché "Freemium", favoris bloqués
- ✅ **Après** : Plan affiché "Pro", favoris illimités accessibles

**Fichiers** :
- `src/contexts/UserContext.tsx`
- `src/hooks/usePermissions.ts`
- `src/hooks/useEmissionFactorAccess.ts`
- `src/pages/SimplifiedSettings.tsx`

### 2. Bug factor_key avec décimales 🔴 CRITIQUE
**Commit** : `b0af4235` - Fix critique: factor_key arrondissait les décimales + auto-rebuild overlays

**Impact** : Intégrité des données
- ❌ **Avant** : Les facteurs d'émission avec décimales étaient arrondis (perte de précision)
- ✅ **Après** : Précision décimale préservée

**Migrations** :
- `20251002_fix_factor_key_decimal_bug.sql`
- `20251002_fix_factor_key_decimal_bug_v2.sql`

### 3. Recherche dans les filtres cassée
**Commit** : `1fd4b196` - fix: Implémenter la recherche dans les filtres (Source, Localisation, etc.)

**Impact** : UX de recherche
- ❌ **Avant** : Impossible de rechercher dans les filtres
- ✅ **Après** : Recherche fonctionnelle dans tous les filtres

## ✨ Nouvelles fonctionnalités

### 1. Système de sources payantes
**Commits** :
- `53a7b348` - feat: ajout verrouillage sources payantes + fix edge function
- `52dd8d7a` - fix: tooltip cadenas sources payantes
- `d266b539` - feat: amélioration tooltip sources payantes
- `b50e3a0f` - fix(tooltip): repositionner tooltip au-dessus de la source
- `472334a8` - feat: rendre les sources payantes cliquables avec indicateur visuel

**Fonctionnalités** :
- ✅ Verrouillage visuel des sources payantes non assignées
- ✅ Icône de cadenas sur les sources
- ✅ Tooltip informatif au survol
- ✅ Sources cliquables avec indicateur

### 2. Simplification des plans
**Commit** : `35b1c4bc` - feat: simplification des plans (Freemium/Pro) et renommage des niveaux d'accès (Gratuit/Payant)

**Changements** :
- ✅ Renommage : Standard/Premium → **Freemium/Pro**
- ✅ Renommage : Free/Paid → **Gratuit/Payant**
- ✅ Interface plus cohérente

### 3. Nouveau système de réindexation des sources
**Commits** :
- `11e3c5e4` - feat: migrate ID alignment and new source reindex flow
- `17e72439` - fix: replace TRUNCATE with DELETE in schedule-source-reindex
- `0e38a4b9` - fix: add pagination for large sources and direct Algolia Task trigger

**Améliorations** :
- ✅ Alignement des IDs entre tables
- ✅ Pagination pour les grandes sources
- ✅ Déclenchement direct des tâches Algolia
- ✅ Nouvelle Edge Function `schedule-source-reindex`

### 4. Auto-rebuild après import
**Commit** : `b0af4235` - auto-rebuild overlays

**Fonctionnalité** :
- ✅ Reconstruction automatique de la projection après import
- ✅ Synchronisation automatique avec Algolia

**Migration** :
- `20251002_auto_rebuild_all_search_on_import.sql`

## 🔧 Améliorations techniques

### 1. Nettoyage de l'architecture Algolia
**Commit** : `4fae1ab3` - refactor(algolia): nettoyer le code legacy et simplifier l'architecture de recherche

**Changements** :
- ✅ Suppression du code legacy
- ✅ Architecture simplifiée
- ✅ Meilleure maintenabilité

### 2. Suppression du flux legacy d'assignation de sources
**Commits** :
- `153532f1` - chore: remove legacy source assignment flow
- `323451cd` - docs: add comprehensive source assignment architecture documentation

**Changements** :
- ✅ Suppression des Edge Functions obsolètes :
  - `manage-fe-source-assignments`
  - `manage-fe-source-assignments-bulk`
- ✅ Documentation complète de la nouvelle architecture
- ✅ Migration supprimée : `20250814102000_bulk_manage_fe_source_assignments.sql`

### 3. Analyse des doublons
**Commit** : `bde61326` - Ajout analyse détaillée des vrais doublons + scripts d'export

**Outils** :
- ✅ Scripts d'analyse des doublons
- ✅ Export CSV pour analyse
- ✅ Détection des vrais doublons vs variations

### 4. Amélioration des filtres Algolia
**Commits** :
- `0686e61e` - feat: réordonnancement des filtres Algolia pour améliorer l'UX
- `fad26306` - chore: resynchroniser la configuration des filtres et du lockfile

**Améliorations** :
- ✅ Ordre des filtres optimisé
- ✅ Meilleure UX de recherche

### 5. Exposition des résultats premium floutés
**Commit** : `b1894a2d` - chore(search): exposer les résultats premium floutés

**Fonctionnalité** :
- ✅ Les utilisateurs Freemium voient les résultats premium (floutés)
- ✅ Incitation à upgrader vers Pro

### 6. Corrections diverses
**Commits** :
- `714d137c` - fix(deps): ajoute @types/react-i18next en devDependency
- `6bbe0a89` - fix: correct Algolia filter syntax for assigned_workspace_ids array
- `932b6e78` - fix: update Algolia Task ID

## 📝 Migrations de base de données

### Nouvelles migrations
1. `20251002_auto_rebuild_all_search_on_import.sql` - Auto-rebuild après import
2. `20251002_fix_factor_key_decimal_bug.sql` - Correction bug décimales
3. `20251002_fix_factor_key_decimal_bug_v2.sql` - Correction bug décimales v2
4. `20250930_merge_view_emission_factors.sql` - Merge des vues
5. `20250930_cleanup_views.sql` - Nettoyage des vues
6. `20250930_deduplicate_emission_factors.sql` - Déduplication
7. `20250930_deduplicate_emission_factors_v2.sql` - Déduplication v2
8. `20250930_run_import_from_staging_autotrigger.sql` - Auto-trigger import

### Migrations supprimées
- `20250814102000_bulk_manage_fe_source_assignments.sql` (legacy)

## 🎯 Impact utilisateurs

### Utilisateurs Pro
- ✅ **Plan affiché correctement** (au lieu de Freemium)
- ✅ **Accès aux favoris illimités** (au lieu de bloqué)
- ✅ **Sources payantes assignées** accessibles
- ✅ **Meilleure UX** avec tooltips et indicateurs

### Utilisateurs Freemium
- ✅ **Visibilité des sources premium** (floutées)
- ✅ **Tooltips informatifs** sur les sources payantes
- ✅ **Incitation claire** à upgrader

### Tous les utilisateurs
- ✅ **Recherche dans les filtres** fonctionnelle
- ✅ **Précision des données** préservée (bug décimales corrigé)
- ✅ **Performance améliorée** (architecture simplifiée)
- ✅ **UX améliorée** (filtres réordonnés, tooltips)

## ⚠️ Risques et points d'attention

### Risques faibles
- ✅ Toutes les migrations ont été testées
- ✅ Le build passe sans erreurs
- ✅ Pas de breaking changes identifiés

### Points d'attention
1. **Vérifier les quotas** après déploiement (surtout pour les utilisateurs Pro)
2. **Tester la recherche** dans tous les filtres
3. **Vérifier les tooltips** sur les sources payantes
4. **Confirmer l'accès aux favoris** pour les utilisateurs Pro

## 📊 Statistiques détaillées

```
564 fichiers modifiés
+34,429 lignes ajoutées
-1,987 lignes supprimées
23 commits
2 Edge Functions supprimées
8 nouvelles migrations
1 migration supprimée
```

## 🚀 Recommandation

**Cette release contient des corrections CRITIQUES** :
1. 🔴 Bug d'affichage du plan et accès aux favoris (affecte tous les utilisateurs Pro)
2. 🔴 Bug de précision décimale (affecte l'intégrité des données)
3. 🟡 Recherche dans les filtres cassée (affecte l'UX)

**Il est FORTEMENT RECOMMANDÉ de déployer cette release dès que possible.**

## ✅ Checklist de déploiement

- [x] Code testé localement
- [x] Build réussi sans erreurs
- [x] Migrations testées
- [x] Documentation créée
- [x] PR #112 créée
- [ ] PR #112 reviewée et approuvée
- [ ] PR #112 mergée dans main
- [ ] Déploiement automatique déclenché
- [ ] Tests post-déploiement effectués
- [ ] Vérification avec guillaumears44@gmail.com
- [ ] Monitoring des erreurs pendant 24h

---

**Date de création** : 6 octobre 2025
**Branche source** : `feature/paid-source-locks`
**Branche cible** : `main`
**PR** : #112




