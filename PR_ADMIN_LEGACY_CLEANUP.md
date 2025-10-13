# Nettoyage Admin Legacy et Correction Filtre Entreprises Payantes

## 🎯 Objectif

Nettoyer les fonctionnalités obsolètes de la page admin et corriger le mapping des entreprises payantes suite à la migration des plans `standard/premium` vers `freemium/pro`.

## 📋 Résumé des changements

### 1. Suppression du bloc "Import de la base" (admin UI obsolète)

Le flow d'import admin passe désormais entièrement par **Dataiku** :
1. Dataiku → `staging_emission_factors` (296k records)
2. Appel manuel `SELECT run_import_from_staging();`
3. Synchronisation automatique vers Algolia

**Frontend supprimé** :
- `AdminImportsPanel.tsx` - Interface d'upload CSV obsolète
- `ImportJobMonitor.tsx` - Monitoring des jobs d'import
- Bloc complet dans `Admin.tsx`

**Edge Functions supprimées** :
- `import-csv` - Utilisée uniquement par l'UI admin obsolète

**✅ Conservé** :
- `chunked-upload` - Utilisée par l'import utilisateur (`/import`)
- `import-csv-user` - Import utilisateur depuis `/import`
- Table `data_imports` - Utilisée par l'import utilisateur
- Flow Dataiku via `run_import_from_staging()`

### 2. Suppression du bloc "Gestion des Comptes Admin"

**Frontend supprimé** :
- `CreateSupraAdmin.tsx` - Création de comptes supra admin
- `OrphanUsersRepair.tsx` - Réparation utilisateurs orphelins
- Bloc complet dans `Admin.tsx`

**Edge Functions supprimées** :
- `create-supra-admin` - Création supra admin
- `cleanup-orphan-users` - Nettoyage orphelins
- `fix-orphan-users` - Duplication de cleanup-orphan-users

### 3. Correction du mapping des entreprises payantes 🐛

**Problème** : Le filtre "Payantes" dans la page admin ne montrait pas les entreprises avec plan "pro" car l'Edge Function filtrait encore sur les anciens plans `['standard', 'premium']`.

**Solution** :
- Fichier : `get-admin-workspaces/index.ts`
- Lignes 79 et 86 : `.in('plan_type', ['standard', 'premium'])` → `.eq('plan_type', 'pro')`
- Version déployée : **v129**

**Vérification base de données** :
- ✅ Contrainte CHECK : `('freemium', 'pro')` uniquement
- ✅ État actuel : 3 workspaces 'pro', 2 workspaces 'freemium'
- ✅ Aucune migration SQL nécessaire

## 📊 Impact

### Fichiers modifiés
- `src/pages/Admin.tsx` - Suppression de 2 blocs complets
- `supabase/functions/get-admin-workspaces/index.ts` - Correction filtre plans

### Fichiers supprimés (Frontend)
- `src/components/admin/AdminImportsPanel.tsx`
- `src/components/admin/ImportJobMonitor.tsx`
- `src/components/admin/CreateSupraAdmin.tsx`
- `src/components/admin/OrphanUsersRepair.tsx`

### Fichiers supprimés (Backend)
- `supabase/functions/import-csv/` (3 fichiers)
- `supabase/functions/create-supra-admin/index.ts`
- `supabase/functions/cleanup-orphan-users/index.ts`

### Edge Functions supprimées via Supabase CLI
```bash
npx supabase functions delete import-csv --project-ref wrodvaatdujbpfpvrzge
npx supabase functions delete create-supra-admin --project-ref wrodvaatdujbpfpvrzge
npx supabase functions delete cleanup-orphan-users --project-ref wrodvaatdujbpfpvrzge
npx supabase functions delete fix-orphan-users --project-ref wrodvaatdujbpfpvrzge
```

### Edge Functions déployées
- `get-admin-workspaces` → v129 (correction filtre plans)

## ✅ Checklist de vérification

- [x] Page `/admin` charge sans erreur console
- [x] Filtre "Payantes" affiche les 3 entreprises avec plan "pro"
- [x] Filtre "Freemium" affiche les 2 entreprises freemium
- [x] Import utilisateur `/import` fonctionne toujours
- [x] Flow Dataiku préservé (`run_import_from_staging()`)
- [x] Edge Functions obsolètes supprimées de Supabase
- [x] Documentation complète créée

## 📚 Documentation

- `docs/migration/2025-10-13_nettoyage_admin_legacy.md` - Documentation technique détaillée
- `NETTOYAGE_ADMIN_LEGACY_SUMMARY.md` - Résumé exécutif du nettoyage

## 🔍 Tests à effectuer

### Page Admin
1. Accéder à `/admin`
2. Vérifier l'absence d'erreurs console
3. Tester le filtre "Payantes" → Doit afficher 3 entreprises "pro"
4. Tester le filtre "Freemium" → Doit afficher 2 entreprises freemium
5. Vérifier que les blocs supprimés n'apparaissent plus

### Import Utilisateur
1. Accéder à `/import`
2. Uploader un fichier CSV de test
3. Vérifier que l'import se déroule normalement
4. Vérifier les logs de `chunked-upload` et `import-csv-user`

### Flow Dataiku (Admin)
1. Vérifier que `run_import_from_staging()` fonctionne toujours
2. Vérifier la synchronisation Algolia automatique
3. Vérifier les logs de la dernière synchronisation

## 📈 Métriques

- **Lignes de code supprimées** : ~1988 lignes
- **Lignes de code ajoutées** : ~231 lignes (documentation)
- **Edge Functions supprimées** : 4 fonctions
- **Edge Functions modifiées** : 1 fonction (get-admin-workspaces)
- **Composants React supprimés** : 4 composants
- **Pages modifiées** : 1 page (Admin.tsx)

## 🔗 Références

- Branche : `feature/admin-legacy-cleanup`
- Base : `main` (ou branche par défaut)
- Supabase CLI : v2.51.0
- Project Ref : `wrodvaatdujbpfpvrzge`

## 🚀 Déploiement

### Étapes déjà effectuées
1. ✅ Suppression des Edge Functions via Supabase CLI
2. ✅ Déploiement de `get-admin-workspaces` v129
3. ✅ Vérification de l'état de la base de données

### Après merge
1. Déployer le frontend sur Vercel/production
2. Vérifier le bon fonctionnement de la page `/admin` en production
3. Vérifier que l'import utilisateur fonctionne toujours
4. Monitorer les logs Edge Functions pour détecter d'éventuelles erreurs

## 💡 Notes importantes

- **Aucune migration SQL nécessaire** : La base de données est déjà conforme avec les plans `freemium/pro`
- **Flow Dataiku préservé** : Le processus d'import admin via Dataiku n'est pas impacté
- **Import utilisateur intact** : Les Edge Functions `chunked-upload` et `import-csv-user` sont conservées
- **Nettoyage progressif** : Cette PR fait partie d'un effort plus large de nettoyage du code legacy

---

**Auteur** : Axel Girard  
**Date** : 13 octobre 2025  
**Type** : Feature (nettoyage + bugfix)

