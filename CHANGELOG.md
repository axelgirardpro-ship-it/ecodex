# Changelog

Tous les changements notables de ce projet seront documentés dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

## [Non publié]

### 2025-10-23
- **🐛 FIX - Corrections bugs Cursor BugBot (PRs #137/#138)** : Correction de 3 bugs remontés par Cursor BugBot
  - Bug #2 : Nettoyage des entrées dupliquées dans `docs/history/INDEX.md` (sections 2025-10-23 répétées 5 fois)
  - Bug #5 : Désactivation du bouton "Partager" si benchmark non sauvegardé sans searchParams valides
  - Bug #8 : Redirection automatique vers `/search` si accès à `/benchmark/view` sans query params
  - Ajout traductions FR/EN pour message d'erreur de partage
  - Amélioration UX : prévention des URLs invalides et pages vides

- **🐛 FIX - ESLint errors dans composants Benchmark** : Correction de 8+ erreurs critiques détectées par Cursor BugBot
  - Remplacement de tous les types `any` par des interfaces typées
  - Correction de 6 erreurs `no-case-declarations` dans `BenchmarkValidationAlert.tsx`
  - Typage strict des `filters` : `Record<string, string | number | boolean>`
  - Changement `let query` → `const query` dans `FilterPanel.tsx`
  - Commit : `eff1b3b5`

- **AMELIORATIONS_BENCHMARK_UI_2025-10-23.md** : Améliorations UI/UX Benchmark : 13 améliorations majeures incluant coloration Q1/Q3, formatage dynamique, support Markdown, et réorganisation des contrôles
  - Documentation complète dans `docs/history/2025-10-23_AMELIORATIONS_BENCHMARK_UI_2025-10-23.md`
- **🐛 HOTFIX - Fix import espaces Unicode** : Correction erreur `"invalid input syntax for type numeric: \"2 051\""` lors import Dataiku
  - Problème : Espaces fines insécables (U+202F) dans le champ FE empêchaient la conversion en numeric
  - Solution : Remplacement du SQL dynamique (EXECUTE) par CREATE TEMPORARY TABLE direct pour échappement regex correct
  - Migration : `20251023_fix_fe_whitespace_in_dynamic_sql.sql`
  - Documentation : `docs/history/2025-10-23_HOTFIX_2025-10-23_fix_import_unicode_whitespace.md`

- **🐛 HOTFIX - Limite Algolia 10KB** : Suppression commentaires pour 316 records BEIS dépassant la limite Algolia
  - 316 records de source BEIS avec commentaires très longs (~5 000 caractères)
  - Sauvegarde dans `backup_oversized_comments` puis suppression des champs Commentaires_fr/en
  - Résultat : Taille max passée de 10.59 KB à 7.95 KB (0 records > 10KB)
  - Documentation : `docs/history/2025-10-23_HOTFIX_2025-10-23_algolia_10kb_limit.md`

---

## [1.6.2] - 2025-10-22

### 🔒 Sécurité - CRITIQUE
- **Edge Function `generate-benchmark`** : Fix vulnérabilité workspace ownership (v1.0.3 → v1.0.4)
  - Ajout validation que l'utilisateur appartient au workspace avant génération
  - Retour `403 Forbidden` pour accès non autorisé
  - Protection contre consommation de quotas d'autres workspaces
  - **Impact** : Tout utilisateur authentifié pouvait générer des benchmarks pour n'importe quel workspace (détecté par bugbot, aucune exploitation constatée)
  - Documentation : `docs/hotfix/2025-10-22-security-fix-workspace-validation.md`

---

## [1.6.1] - 2025-10-22

### Amélioré
- **Validation pré-navigation pour Benchmark** : Détection des FEs inaccessibles (floutés/verrouillés) directement sur `/search`
  - Nouveau code d'erreur `INSUFFICIENT_ACCESSIBLE_DATA` dans `useBenchmarkValidation`
  - Alerte contextuelle empêchant la navigation inutile vers une page d'erreur
  - Filtrage intelligent basé sur `variant`, `is_blurred`, et `access_level`
  - Messages clairs avec compteur de FEs accessibles vs total
- **UI BenchmarkHeader** : Gestion du débordement du titre long
  - Troncature avec ellipses (`...`) pour les titres trop longs
  - Tooltip natif au survol pour afficher le titre complet
  - Boutons d'action toujours visibles (flex-shrink-0)

### Corrigé
- **Edge Function `generate-benchmark`** : Boot error résolu
  - Restauration de l'authentification native Supabase (`supabaseAuth.auth.getUser()`)
  - Suppression du décodage JWT manuel complexe avec `atob()`
  - Simplification de la validation utilisateur
- **Linter** : Correction de toutes les erreurs TypeScript dans l'Edge Function
  - Ajout de `@ts-nocheck` pour le runtime Deno
  - Type explicite `warnings: string[]`
  - Création de `deno.json` pour configuration TypeScript

### Technique
- Edge Function version `1.0.3`
- 0 erreur de lint dans le projet
- Cohérence validation frontend ↔ backend (minimum 10 FEs accessibles)

---

## [1.6.0] - 2025-10-22

### Ajouté
- **Feature Benchmark complète** : Génération d'analyses statistiques des facteurs d'émission
  - 17 composants React (graphiques, statistiques, tables, exports)
  - Edge Function `generate-benchmark` avec validation stricte
  - Export PDF haute qualité et PNG
  - Sauvegarde et partage des benchmarks au sein du workspace
  - Quotas : 3 benchmarks pour Freemium, illimité pour Pro
  - Documentation complète dans `docs/features/benchmark-feature.md`
- Intégration complète du bouton "Générer un benchmark" sur la page `/search`
- Extension du `NavbarQuotaWidget` pour afficher les quotas benchmarks
- Routes `/benchmark` et `/benchmark/:id`

### Détails techniques
- Table PostgreSQL `benchmarks` avec RLS
- Migration `20251022092500_create_benchmarks_table.sql`
- 100+ clés de traduction FR/EN dans le namespace `benchmark`
- Voir `IMPLEMENTATION_COMPLETE.md` et `BENCHMARK_COMPONENTS_STATUS.md` pour plus de détails

---

## [1.5.2] - 2025-10-20

### Corrigé
- **Hotfix critique** : Filtre "Private" (Base personnelle) retournait 0 résultats
  - Correction de la syntaxe Algolia dans l'Edge Function `algolia-search-proxy` (v132)
  - Migration de `filters` vers `facetFilters` pour le champ `workspace_id`
  - 117 records privés désormais accessibles correctement
  - Documentation dans `HOTFIX_FILTRE_PRIVATE_ALGOLIA_20251020.md`
- **Optimisation Base de Données** : Suppression du webhook HTTP obsolète
  - Migration `20251020_remove_obsolete_fe_sources_webhook_trigger_v2.sql`
  - Performance UPDATE sur `fe_sources` : 19ms → 0.7ms (-96.3%, 27x plus rapide)
  - Détails dans `OPTIMISATIONS_OPTIONNELLES_PROPOSITIONS.md`
- **Configuration autovacuum** : Maintenance améliorée pour les petites tables
  - Migration `20251020_configure_aggressive_autovacuum.sql`
  - Tables `user_roles`, `favorites`, `workspaces` avec seuil agressif (5 dead rows)

### Amélioré
- Corrections des Security Advisors (+91% de sécurité)
- Rapport complet dans `RAPPORT_CORRECTIONS_ADVISORS_20251020.md`

---

## [1.5.1] - 2025-10-16

### Ajouté
- **Migration des champs de score Algolia** :
  - 4 nouveaux champs : `localization_score`, `perimeter_score`, `base_score`, `unit_score`
  - Migration `20251015_add_algolia_score_fields.sql`
  - Index partiels pour optimiser les performances
  - Détails dans `MIGRATION_SCORES_ALGOLIA_20251015.md`
- Edge Function `algolia-search-proxy` : Correctifs JWT et authentification
  - Détails dans `docs/hotfix/2025-10-20-fix-edge-function-jwt-auth.md`

### Corrigé
- Problèmes de blur sur facets Algolia
  - Hotfix v131 documenté dans `docs/hotfix/2025-10-20-fix-algolia-facets-blur-v131.md`
- Highlighting Algolia
  - Hotfix v118 documenté dans `docs/hotfix/2025-10-20-fix-algolia-highlighting-v118.md`

---

## [1.5.0] - 2025-10-16

### Ajouté
- **Optimisation React Query complète** : Réduction drastique des requêtes réseau
  - Migration de tous les hooks vers React Query (`useQuotas`, `useEmissionFactorAccess`, `useSupraAdmin`, etc.)
  - Configuration centralisée dans `src/lib/queryClient.ts`
  - Query keys organisées dans `src/lib/queryKeys.ts`
  - React Query DevTools intégrées (mode développement)

### Amélioré
- **Performance réseau** : -83% de requêtes (150 → 25)
  - `search_quotas` GET : 32+ → 1 requête (-97%)
  - `fe_sources` GET : 19+ → 1 requête (-95%)
  - `fe_source_workspace_assignments` GET : 18+ → 1 requête (-94%)
  - `is_supra_admin` RPC : 10+ → 1 requête (-90%)
  - `search_quotas` POST : 19+ → 1-2 requêtes (-90%)
- **Temps de chargement** : 3-5s → 1-2s (-60%)
- **Debounce** : 5 secondes sur `useQuotaSync` pour réduire les écritures en base
- **Realtime** : Circuit breaker pattern pour éviter les tentatives infinies de reconnexion
- Cache intelligent selon le type de données (30s à 24h selon la volatilité)

### Documentation
- Rapport complet dans `OPTIMISATION_REACT_QUERY_COMPLETE.md`
- Changelog détaillé dans `CHANGELOG_REACT_QUERY.md`
- Guide de tests dans `GUIDE_TEST_VISUEL.md`
- Résumé exécutif dans `MIGRATION_SUMMARY.md`

---

## [1.4.1] - 2025-10-16

### Corrigé
- **Erreurs Realtime** : Circuit breaker ajouté dans `useOptimizedRealtime`
  - Maximum 3 tentatives de reconnexion
  - Changement de `private: true` → `private: false` pour les canaux
  - Documentation dans `CORRECTIONS_REALTIME_ET_QUOTAS.md`
- **Optimisation des requêtes** `search_quotas` :
  - `staleTime` : 30s → 60s
  - `gcTime` : 60s → 10min

---

## [1.4.0] - 2025-10-16

### Ajouté
- **Analyse réseau post-optimisation React Query**
  - Audit détaillé des duplications de requêtes
  - Identification des problèmes Realtime
  - 32+ appels dupliqués sur `search_quotas` détectés
  - Documentation dans `AUDIT_RESEAU_MANGUE_20241016.md` et `ANALYSE_RESEAU_POST_OPTIMISATION.md`

---

## [1.3.0] - 2025-10-15

### Ajouté
- **Nettoyage de la codebase** : Suppression de ~80+ fichiers obsolètes
  - Documentation de session et rapports temporaires
  - Backups et logs historiques
  - Scripts de diagnostic temporaires
  - Détails dans `NETTOYAGE_LEGACY_20251015.md`

---

## [1.2.0] - 2025-10-15

### Ajouté
- **Comparatif complet des solutions Vector DB** (Octobre 2025)
  - Analyse Pinecone vs Qdrant vs pgvector
  - Verdict : Supabase pgvector reste la solution optimale
  - Documentation dans `COMPARATIF_VECTOR_DB_OCT2025.md`

---

## [1.1.0] - 2025-10-15

### Ajouté
- Migration des champs de score Algolia
- Task ID Algolia mis à jour : `55278ecb-f8dc-43d8-8fe6-aff7057b69d0`

---

## [1.0.0] - 2025-10-XX

### Initial
- Architecture initiale de l'application
- Système de recherche Algolia
- Gestion des utilisateurs et workspaces
- Système de quotas et permissions
- Intégration Supabase (Auth, DB, Storage, Edge Functions)

---

## Format des entrées

Ce changelog suit les conventions suivantes :

### Sections
- **Ajouté** : Nouvelles fonctionnalités
- **Modifié** : Changements dans les fonctionnalités existantes
- **Déprécié** : Fonctionnalités bientôt supprimées
- **Supprimé** : Fonctionnalités supprimées
- **Corrigé** : Corrections de bugs
- **Sécurité** : Corrections de vulnérabilités

### Références
Pour plus de détails sur chaque changement, consultez :
- Les fichiers de documentation dans `docs/`
- Les rapports d'historique dans `docs/history/`
- Les migrations dans `supabase/migrations/`
- Le fichier `docs/history/INDEX.md` pour une vue chronologique complète

---

**Légende des versions**
- Format : `[MAJEUR.MINEUR.CORRECTIF]`
- MAJEUR : Changements incompatibles avec les versions précédentes
- MINEUR : Ajout de fonctionnalités rétro-compatibles
- CORRECTIF : Corrections de bugs rétro-compatibles


