# Index de la documentation - Projet DataCarb

## 📚 Documentation principale (2025-10-15)

### Session complète : Gestion des accès aux sources
- **`SESSION_SUMMARY_20251015_SOURCE_ACCESS_COMPLETE.md`** ⭐
  - Document principal consolidant toute la session du 15 octobre 2025
  - Couvre : timeouts, incohérence frontend/backend, système de blur, assignations
  - Inclut : architecture, migrations, tests, métriques

- **`CHANGELOG_20251015.md`**
  - Résumé exécutif des changements
  - Impact et métriques
  - Guide de déploiement

### Migrations
- **`supabase/migrations/README_20251015_SOURCE_ACCESS.md`**
  - Documentation détaillée des 3 migrations créées
  - Tests post-migration
  - Guide de rollback

---

## 🗂️ Sessions historiques

### Import et corrections de données
- `SESSION_SUMMARY_20251013.md` : Corrections import admin
- `SESSION_SUMMARY_20251013_IMPORT_FIX.md` : Fix import BTRIM
- `SESSION_SUMMARY_20251014_FIX_FE_SPACES.md` : Correction espaces FE
- `SESSION_SUMMARY_PR_114.md` : Pull Request 114

### Autres bugfixes
- `BUGFIX_SOURCE_ASSIGNMENT_CASE.md` : Case sensitivity
- `BUGFIX_FAVORITES_ACCESS.md` : Accès favoris
- `BUGFIX_FAVORITES_FREEMIUM.md` : Plan freemium favoris
- `BUGFIX_PLAN_DISPLAY.md` : Affichage plan

### Release notes
- `RELEASE_NOTES_v2.md` : Version 2.0
- `RELEASE_NOTES_v2.1.md` : Version 2.1
- `RELEASE_NOTES_FE_SPACES_FIX.md` : Fix espaces FE
- `RELEASE_NOTES_SOURCE_ASSIGNMENT_FIX.md` : Fix assignation sources

---

## 🏗️ Architecture & Design

### Documentation technique
- `docs/architecture/search-i18n.md` : Internationalisation recherche
- `docs/architecture/search-optimization.md` : Optimisation recherche
- `docs/architecture/search-security.md` : Sécurité recherche
- `docs/architecture/source-assignment-flow.md` : Flux d'assignation sources

### API & Intégration
- `docs/api/edge-function-api.md` : Documentation Edge Functions
- `docs/frontend/integration-guide.md` : Guide d'intégration frontend

### Features
- `docs/features/paid-source-locks.md` : Verrouillage sources payantes

---

## 🔧 Scripts utilitaires

### Nettoyage et maintenance
- `scripts/cleanup_free_source_assignments.sql` : Nettoyage assignations sources free
- `scripts/validate_no_duplicate_ids.sql` : Validation unicité IDs

### Export et analyse
- `scripts/export_doublons_simple.sql` : Export doublons simples
- `scripts/export_vrais_doublons_complet.sql` : Export doublons complet
- `scripts/export_vrais_doublons.py` : Export doublons (Python)
- `scripts/export_vrais_doublons_csv.py` : Export doublons CSV
- `scripts/analyze_duplicates_detailed.py` : Analyse détaillée doublons
- `scripts/analyze_natural_key_complete.py` : Analyse clés naturelles

### Import et déploiement
- `scripts/import-and-reindex.sh` : Import et réindexation
- `scripts/deploy-algolia-optimization.sh` : Déploiement Algolia
- `scripts/README_import_cli.md` : Guide import CLI

### Tests
- `scripts/test_dataiku_integrity.py` : Tests intégrité Dataiku

### Utilitaires CSV
- `scripts/csv-header-columns.js` : Extraction colonnes CSV
- `scripts/csv-header-to-sql.js` : Conversion CSV vers SQL

---

## 🔬 Dataiku & Matching

### Recettes principales
- `dataiku_id_matching_recipe_FINAL.py` ⭐ : Recette finale matching IDs
- `dataiku_id_matching_recipe_fixed.py` : Version corrigée

### Documentation
- `DATAIKU_README.md` : Documentation principale Dataiku
- `GUIDE_DATAIKU_ID_MATCHING.md` : Guide matching IDs
- `RESUME_SESSION_DATAIKU.md` : Résumé session Dataiku

---

## 📋 Guides & Plans

### Guides d'optimisation
- `GUIDE_EXECUTION_OPTIMISATIONS.md` : Optimisations d'exécution

### Documentation de migration
- `docs/migration/` : Dossier contenant 21 fichiers de migration détaillés
  - BUGFIX historiques
  - Guides de migration
  - Documentation des changements de schéma

---

## 🧹 Nettoyage & Refactoring

### Rapports de nettoyage
- `CLEANUP_COMPLETE.md` : Nettoyage complet
- `CLEANUP_LEGACY.md` : Nettoyage legacy
- `CLEANUP_BRANCHES_REPORT.md` : Nettoyage branches
- `LEGACY_CLEANUP_REPORT.md` : Rapport nettoyage legacy
- `NETTOYAGE_ADMIN_LEGACY_SUMMARY.md` : Nettoyage admin

### Plans & Résumés
- `MIGRATION_PLAN_SIMPLIFICATION_COMPLETE.md` : Plan simplification
- `NATIVE_IMPLEMENTATION_SUMMARY.md` : Implémentation native
- `REFACTOR-SEARCH-OPTIMIZATION.md` : Refactoring recherche

---

## 🚀 Déploiement

### Scripts de déploiement
- `deploy.sh` : Script de déploiement principal
- `cleanup_branches.sh` : Nettoyage branches

### Configuration
- `supabase-config-instructions.md` : Instructions config Supabase
- `vercel.json` : Configuration Vercel

### Validation
- `DEPLOYMENT_VALIDATION.md` : Validation déploiement
- `VERIFICATION_FINAL.md` : Vérification finale

---

## 📊 Optimisations SQL

### Analyses de performance
- `analyse_performance_indexes.sql` : Analyse performance index
- `nettoyage_index_inutilises.sql` : Nettoyage index inutilisés
- `optimisation_politiques_rls.sql` : Optimisation RLS
- `migrations_securite_performance.sql` : Migrations sécurité/performance
- `validation_finale_optimisations.sql` : Validation optimisations

---

## 🔐 Sécurité

### Documentation sécurité
- `docs/security/search-security.md` : Sécurité de la recherche

---

## 🐛 Troubleshooting

### Guides de dépannage
- `docs/troubleshooting/` : 2 fichiers de troubleshooting

---

## 📝 Notes importantes

### Fichiers supprimés (consolidés)
Les fichiers suivants ont été **supprimés** car leur contenu a été intégré dans `SESSION_SUMMARY_20251015_SOURCE_ACCESS_COMPLETE.md` :

- ❌ `BUGFIX_ASSIGNMENT_TIMEOUT.md`
- ❌ `BUGFIX_EMBER_TIMEOUT.md`
- ❌ `BUGFIX_TRIGGERS_TIMEOUT_FINAL.md`
- ❌ `BUGFIX_SOURCE_BLUR_AND_ASSIGNMENTS.md`
- ❌ `BUGFIX_ACCESS_LEVEL_TIMEOUT.md`
- ❌ `SESSION_SUMMARY_20251015_SOURCE_MANAGEMENT.md`
- ❌ `PLAN_FIX_ACCESS_LEVEL_DEFAULT.md`
- ❌ `robustify-source-access-management.plan.md`

### Priorité de lecture
Pour comprendre les changements récents, lire dans cet ordre :

1. **`CHANGELOG_20251015.md`** (résumé exécutif)
2. **`SESSION_SUMMARY_20251015_SOURCE_ACCESS_COMPLETE.md`** (détails complets)
3. **`supabase/migrations/README_20251015_SOURCE_ACCESS.md`** (détails migrations)

---

## 🔄 Maintenance de cet index

Cet index doit être mis à jour lors de :
- Création de nouvelles sessions majeures
- Ajout de nouveaux guides
- Changements architecturaux significatifs
- Consolidation/suppression de documentation

**Dernière mise à jour** : 2025-10-15

