# Résumé du nettoyage admin legacy

**Date**: 13 octobre 2025
**Branche**: fix/markdown-rendering-and-highlighting

## Changements effectués

### 1. ✅ Suppression du bloc "Import de la base" (admin UI)

#### Frontend
- ✅ Supprimé l'import `AdminImportsPanel` dans `/src/pages/Admin.tsx`
- ✅ Supprimé le bloc complet "Import de la base (FR)" dans `/src/pages/Admin.tsx`
- ✅ Supprimé `/src/components/admin/AdminImportsPanel.tsx`
- ✅ Supprimé `/src/components/admin/ImportJobMonitor.tsx`

#### Backend
- ✅ Supprimé `/supabase/functions/import-csv/` (dossier complet local + déployé sur Supabase)
- ✅ **CONSERVÉ** `/supabase/functions/chunked-upload/` (utilisé par import utilisateur page `/import`)
- ✅ **CONSERVÉ** `/supabase/functions/import-csv-user/` (import utilisateur)
- ✅ **CONSERVÉ** table `data_imports` (utilisée par import utilisateur)

### 2. ✅ Suppression du bloc "Gestion des Comptes Admin"

#### Frontend
- ✅ Supprimé les imports `CreateSupraAdmin` et `OrphanUsersRepair` dans `/src/pages/Admin.tsx`
- ✅ Supprimé le bloc complet "Gestion des Comptes Admin" (lignes 107-114)
- ✅ Supprimé `/src/components/admin/CreateSupraAdmin.tsx`
- ✅ Supprimé `/src/components/admin/OrphanUsersRepair.tsx`

#### Backend
- ✅ Supprimé `/supabase/functions/create-supra-admin/` (dossier complet local + déployé sur Supabase)
- ✅ Supprimé `/supabase/functions/cleanup-orphan-users/` (dossier complet local + déployé sur Supabase)
- ✅ Supprimé `/supabase/functions/fix-orphan-users/` (déployé sur Supabase - duplication)

### 3. ✅ Correction du mapping des entreprises payantes

#### Fichier modifié : `/supabase/functions/get-admin-workspaces/index.ts`

**Avant** (lignes 79 et 86) :
```typescript
workspacesQuery = workspacesQuery.in('plan_type', ['standard', 'premium']);
```

**Après** :
```typescript
workspacesQuery = workspacesQuery.eq('plan_type', 'pro');
```

**Résultat** : Les entreprises avec plan "pro" apparaissent maintenant correctement dans l'onglet "Payantes"

**Déploiement** : ✅ Edge Function mise à jour (version 129) et déployée sur Supabase

### 4. ℹ️ Migration SQL non nécessaire

La vérification en base de données a confirmé :
- ✅ Contrainte CHECK sur `workspaces.plan_type` : `('freemium', 'pro')` uniquement
- ✅ Données actuelles : 3 workspaces 'pro', 2 workspaces 'freemium'
- ✅ Aucun 'standard' ou 'premium' présent dans la base

**Conclusion** : Pas de migration SQL nécessaire, les données sont déjà conformes.

## Flow d'import admin conservé (Dataiku)

Le flow suivant reste **FONCTIONNEL** :
1. Dataiku pousse les données dans `public.staging_emission_factors` (296k records)
2. Appel manuel dans Dataiku : `SELECT public.run_import_from_staging();`
3. La fonction SQL copie staging → `emission_factors` → `emission_factors_all_search`
4. Synchronisation Algolia automatique via webhook

## Vérifications à effectuer

- [ ] Tester l'accès à la page `/admin`
- [ ] Vérifier que le filtre "Payantes" affiche les 3 entreprises avec plan "pro"
- [ ] Confirmer que le filtre "Freemium" affiche les 2 entreprises freemium
- [ ] Tester l'import utilisateur sur la page `/import` (utilise chunked-upload conservé)
- [ ] Vérifier qu'il n'y a pas d'erreurs console liées aux composants supprimés

## Fichiers supprimés

### Frontend
- `/src/components/admin/AdminImportsPanel.tsx`
- `/src/components/admin/ImportJobMonitor.tsx`
- `/src/components/admin/CreateSupraAdmin.tsx`
- `/src/components/admin/OrphanUsersRepair.tsx`

### Backend (local + Supabase)
- `/supabase/functions/import-csv/` (dossier complet local + Edge Function déployée)
- `/supabase/functions/create-supra-admin/` (dossier complet local + Edge Function déployée)
- `/supabase/functions/cleanup-orphan-users/` (dossier complet local + Edge Function déployée)
- Edge Function `fix-orphan-users` (déployée sur Supabase uniquement - duplication)

## Fichiers modifiés

- `/src/pages/Admin.tsx` : Suppression des imports et blocs obsolètes
- `/supabase/functions/get-admin-workspaces/index.ts` : Correction du filtre 'paid' (pro uniquement)

## Edge Functions supprimées de Supabase (via CLI)

Les Edge Functions suivantes ont été supprimées du projet Supabase (wrodvaatdujbpfpvrzge) :

```bash
✅ npx supabase functions delete import-csv --project-ref wrodvaatdujbpfpvrzge
✅ npx supabase functions delete create-supra-admin --project-ref wrodvaatdujbpfpvrzge
✅ npx supabase functions delete cleanup-orphan-users --project-ref wrodvaatdujbpfpvrzge
✅ npx supabase functions delete fix-orphan-users --project-ref wrodvaatdujbpfpvrzge
```

## Edge Function mise à jour sur Supabase

```bash
✅ get-admin-workspaces : Version 129 déployée avec correction du filtre 'paid'
```

