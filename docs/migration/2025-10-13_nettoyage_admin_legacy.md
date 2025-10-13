# Nettoyage Admin Legacy - 13 octobre 2025

## Contexte

Suppression des fonctionnalités obsolètes de la page admin et correction du mapping des entreprises payantes suite à la migration des plans `standard/premium` vers `freemium/pro`.

## Objectifs

1. Supprimer le bloc "Import de la base" (admin UI) devenu obsolète avec le flow Dataiku
2. Supprimer le bloc "Gestion des Comptes Admin" (création supra admin et réparation utilisateurs orphelins)
3. Corriger le filtre des entreprises payantes pour afficher correctement les plans "pro"

## Changements effectués

### 1. Suppression du bloc "Import de la base" (admin UI)

#### Frontend supprimé
- `/src/components/admin/AdminImportsPanel.tsx`
- `/src/components/admin/ImportJobMonitor.tsx`
- Imports et références dans `/src/pages/Admin.tsx`

#### Edge Functions supprimées
- `import-csv` - Utilisée uniquement par l'UI admin obsolète

#### Edge Functions conservées ✅
- `chunked-upload` - Utilisée par l'import utilisateur (`/src/pages/Import.tsx` ligne 321)
- `import-csv-user` - Import utilisateur depuis la page `/import`
- Table `data_imports` - Utilisée par l'import utilisateur

#### Flow Dataiku conservé ✅
Le flow d'import admin via Dataiku reste **fonctionnel** :
1. Dataiku → `public.staging_emission_factors` (296k records)
2. Appel manuel : `SELECT public.run_import_from_staging();`
3. Fonction SQL → `emission_factors` → `emission_factors_all_search`
4. Synchronisation Algolia automatique via webhook

### 2. Suppression du bloc "Gestion des Comptes Admin"

#### Frontend supprimé
- `/src/components/admin/CreateSupraAdmin.tsx`
- `/src/components/admin/OrphanUsersRepair.tsx`
- Bloc complet et imports dans `/src/pages/Admin.tsx`

#### Edge Functions supprimées
- `create-supra-admin` - Création de comptes supra admin
- `cleanup-orphan-users` - Nettoyage des utilisateurs orphelins
- `fix-orphan-users` - Duplication de cleanup-orphan-users

### 3. Correction du mapping des entreprises payantes

#### Problème
Le filtre "Payantes" dans la page admin ne montrait pas les entreprises avec plan "pro" car l'Edge Function `get-admin-workspaces` filtrait encore sur les anciens plans `['standard', 'premium']`.

#### Solution
**Fichier** : `/supabase/functions/get-admin-workspaces/index.ts`

**Avant** (lignes 79 et 86) :
```typescript
workspacesQuery = workspacesQuery.in('plan_type', ['standard', 'premium']);
```

**Après** :
```typescript
workspacesQuery = workspacesQuery.eq('plan_type', 'pro');
```

**Déploiement** : Version 129 déployée sur Supabase

#### Vérification base de données
- ✅ Contrainte CHECK sur `workspaces.plan_type` : `('freemium', 'pro')` uniquement
- ✅ Données actuelles : 3 workspaces 'pro', 2 workspaces 'freemium'
- ✅ Aucune migration SQL nécessaire

## Impact

### Pages affectées
- `/admin` - Page admin épurée (2 blocs supprimés)

### Pages non affectées
- `/import` - Import utilisateur continue de fonctionner normalement
- Flow Dataiku - Aucun impact sur l'import admin via `run_import_from_staging()`

### Edge Functions
- **Supprimées** : 4 fonctions (import-csv, create-supra-admin, cleanup-orphan-users, fix-orphan-users)
- **Modifiées** : 1 fonction (get-admin-workspaces v129)
- **Conservées** : 26 fonctions actives

## Vérifications à effectuer

- [ ] Accéder à `/admin` et vérifier qu'il n'y a pas d'erreur console
- [ ] Vérifier que le filtre "Payantes" affiche les 3 entreprises avec plan "pro"
- [ ] Vérifier que le filtre "Freemium" affiche les 2 entreprises freemium
- [ ] Tester l'import utilisateur sur `/import` avec un fichier CSV
- [ ] Vérifier que le flow Dataiku fonctionne toujours

## Commandes Supabase CLI exécutées

```bash
# Mise à jour CLI
brew upgrade supabase  # 2.45.5 → 2.51.0

# Suppression Edge Functions
npx supabase functions delete import-csv --project-ref wrodvaatdujbpfpvrzge
npx supabase functions delete create-supra-admin --project-ref wrodvaatdujbpfpvrzge
npx supabase functions delete cleanup-orphan-users --project-ref wrodvaatdujbpfpvrzge
npx supabase functions delete fix-orphan-users --project-ref wrodvaatdujbpfpvrzge
```

## Références

- Issue : Nettoyage admin legacy et correction mapping entreprises payantes
- Branche : `feature/admin-legacy-cleanup`
- Supabase CLI : v2.51.0

