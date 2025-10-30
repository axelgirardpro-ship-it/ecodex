# Architecture : Flux d'assignation de sources premium

## Vue d'ensemble

Ce document décrit le flux d'assignation de sources premium aux workspaces, utilisant le système de Task Algolia pour garantir robustesse et cohérence.

## Architecture globale

### Flux 1 : Assignation workspace (schedule-source-reindex)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Admin UI)                       │
│                      src/lib/adminApi.ts                         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              Edge Function: schedule-source-reindex              │
│         supabase/functions/schedule-source-reindex/              │
│                                                                   │
│  1. UPDATE fe_source_workspace_assignments                       │
│  2. REFRESH emission_factors_all_search (via SQL function)       │
│  3. POPULATE algolia_source_assignments_projection (nettoyée)    │
│  4. TRIGGER Algolia Task ID: f3cd3fd0-2db4-49fa-be67-...         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Algolia Task Indexing                       │
│              Task ID: f3cd3fd0-2db4-49fa-be67-...                │
│                                                                   │
│  • Lecture: algolia_source_assignments_projection                │
│  • Update partiel des attributs (assigned_workspace_ids)         │
│  • Opération idempotente                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Flux 2 : Changement access_level (trigger automatique)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Admin UI)                       │
│            EmissionFactorAccessManager.tsx                       │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│              UPDATE fe_sources.access_level                      │
│                   (free ↔ paid)                                  │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼ (trigger automatique)
┌─────────────────────────────────────────────────────────────────┐
│       trigger_algolia_on_access_level_change()                   │
│                                                                   │
│  1. TRUNCATE algolia_access_level_projection                     │
│  2. INSERT records de cette source uniquement                    │
│  3. TRIGGER Algolia Task ID: 22394099-b71a-48ef-9453-...         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Algolia Task Indexing                       │
│              Task ID: 22394099-b71a-48ef-9453-...                │
│                                                                   │
│  • Lecture: algolia_access_level_projection                      │
│  • Update partiel de access_level (source uniquement)            │
│  • AVANT: 625k records • APRÈS: ~17k records (gain 97%)          │
└─────────────────────────────────────────────────────────────────┘
```

## Composants détaillés

### 1. Frontend API (`src/lib/adminApi.ts`)

#### Fonctions principales

##### `assignFeSourceToWorkspace(sourceName: string, workspaceId: string)`
Assigne une source premium à un workspace.

**Exemple :**
```typescript
await assignFeSourceToWorkspace('CBAM', 'workspace-uuid-123')
```

##### `unassignFeSourceFromWorkspace(sourceName: string, workspaceId: string)`
Désassigne une source premium d'un workspace.

##### `syncWorkspaceAssignments(workspaceId: string, assigned: string[], unassigned: string[])`
Permet d'assigner/désassigner plusieurs sources en une fois (bulk).

**Implémentation :** Boucle sur les sources et appelle `assignFeSourceToWorkspace` / `unassignFeSourceFromWorkspace` pour chacune.

### 2. Edge Function (`schedule-source-reindex`)

**Path :** `supabase/functions/schedule-source-reindex/index.ts`

#### Étapes d'exécution

##### Étape 1 : Vérification des permissions
```typescript
const { data: isAdminData } = await supabase.rpc("is_supra_admin", { user_uuid: user.id });
```

Seuls les supra admins peuvent exécuter cette fonction.

##### Étape 2 : Mise à jour des assignations
```typescript
// Pour assign
await supabase
  .from("fe_source_workspace_assignments")
  .upsert({ source_name, workspace_id }, { onConflict: "source_name,workspace_id" });

// Pour unassign
await supabase
  .from("fe_source_workspace_assignments")
  .delete()
  .eq("source_name", source_name)
  .eq("workspace_id", workspace_id);
```

##### Étape 3 : Rafraîchissement de la projection principale
```typescript
await supabase.rpc("refresh_ef_all_for_source", { p_source: source_name });
```

Cette fonction SQL :
- Supprime tous les records de la source dans `emission_factors_all_search`
- Réinsère les records globaux depuis `emission_factors`
- Réinsère les overlays users depuis `user_factor_overlays`
- Reconstruit `assigned_workspace_ids` depuis `fe_source_workspace_assignments`

##### Étape 4 : Nettoyage et population de la projection Algolia
```typescript
// Appel de la fonction SQL qui vide et remplit la table en une seule opération
await supabase.rpc("fill_algolia_assignments_projection", {
  p_source: source_name
});
```

**Optimisation (migration 20251030) :** 
- La fonction `fill_algolia_assignments_projection` vide d'abord `algolia_source_assignments_projection`
- Puis remplit la table avec UNIQUEMENT les records de la source en cours
- Gain : Table toujours propre, pas d'accumulation de données obsolètes (avant: 20k+ lignes, après: ~6-17k par source)

##### Étape 5 : Déclenchement de la Task Algolia
```typescript
const taskUrl = `https://data.eu.algolia.com/2/tasks/${taskId}/run`;
await fetch(taskUrl, {
  method: "POST",
  headers: {
    "x-algolia-application-id": ALGOLIA_APP_ID,
    "x-algolia-api-key": ALGOLIA_ADMIN_KEY
  }
});
```

### 3. Tables de données

#### `fe_source_workspace_assignments`
**Rôle :** Source de vérité pour les assignations workspace.

| Colonne | Type | Description |
|---------|------|-------------|
| `source_name` | text | Nom de la source (ex: "CBAM") |
| `workspace_id` | uuid | ID du workspace assigné |
| `created_at` | timestamptz | Date d'assignation |

**Contrainte :** `UNIQUE(source_name, workspace_id)`

#### `algolia_source_assignments_projection`
**Rôle :** Table temporaire pour alimenter la Task Algolia (assignations workspace).

| Colonne | Type | Description |
|---------|------|-------------|
| `id_fe` | text | Identifiant unique du facteur d'émission |
| `source_name` | text | Nom de la source |
| `assigned_workspace_ids` | uuid[] | Liste des workspaces assignés |
| `updated_at` | timestamptz | Date de dernière mise à jour |

**Cycle de vie (optimisé migration 20251030) :**
1. **Vidée automatiquement** par `fill_algolia_assignments_projection` avant chaque assignation
2. Remplie avec tous les records de la source en cours uniquement
3. Lue par la Task Algolia `f3cd3fd0-2db4-49fa-be67-6bd88cbc5950`
4. Reste en place jusqu'à la prochaine assignation (table tampon réutilisable)

**Avant optimisation :** Table jamais vidée, accumulation de 20 741 lignes obsolètes  
**Après optimisation :** Table contient uniquement la source en cours (~6-17k lignes max)

#### `algolia_access_level_projection`
**Rôle :** Table temporaire pour synchroniser `access_level` lors de changements free ↔ paid.

| Colonne | Type | Description |
|---------|------|-------------|
| `id_fe` | text PRIMARY KEY | Identifiant unique du facteur d'émission |
| `source_name` | text | Nom de la source |
| `access_level` | text | Niveau d'accès ('free' ou 'paid') |
| `updated_at` | timestamptz | Date de dernière mise à jour |

**Cycle de vie (migration 20251030) :**
1. Vidée automatiquement par trigger `trigger_algolia_on_access_level_change`
2. Remplie avec UNIQUEMENT les records de la source modifiée
3. Lue par Task Algolia `22394099-b71a-48ef-9453-e790b3159ade`
4. Reste en place jusqu'au prochain changement access_level

**Gain performance :**
- **AVANT** : Partial update de 625 000 records Algolia
- **APRÈS** : Partial update de ~17 000 records (INIES) ou ~6 000 (CBAM)
- **Réduction** : ~97% de records mis à jour

#### `emission_factors_all_search`
**Rôle :** Projection complète pour Algolia (globale + user imports).

**Champs clés :**
- `ID_FE` : Identifiant Dataiku (clé primaire logique)
- `object_id` : ObjectID Algolia (`ID_FE` pour records globaux, `overlay_id` pour imports users)
- `scope` : `'public'` (admin) ou `'private'` (user import)
- `workspace_id` : NULL pour records globaux, UUID pour imports users
- `assigned_workspace_ids` : Liste des workspaces ayant accès (pour sources premium)

### 4. Fonctions SQL critiques

#### `refresh_ef_all_for_source(p_source text)`
**Path :** `supabase/migrations/20251001_refonte_import_admin.sql` (lignes 315-438)

**Responsabilités :**
1. Supprimer tous les records de la source
2. Réinsérer les records globaux avec `assigned_workspace_ids` reconstruit
3. Réinsérer les overlays users

**Garantie :** Cette fonction préserve TOUJOURS les imports users et reconstruit les assignations depuis `fe_source_workspace_assignments`.

#### `fill_algolia_assignments_projection(p_source text)`
**Path :** `supabase/migrations/20251030_optimize_algolia_projections.sql`

**Responsabilités :**
1. Vider complètement `algolia_source_assignments_projection`
2. Remplir avec UNIQUEMENT les records de la source donnée
3. Utilisée par Edge Function `schedule-source-reindex`

**Avantage :** Évite l'accumulation de données obsolètes dans la table tampon (gain mémoire + performance Algolia).

#### `trigger_algolia_on_access_level_change()`
**Path :** `supabase/migrations/20251030_optimize_algolia_projections.sql`

**Déclenchement :** Trigger automatique sur `UPDATE fe_sources.access_level`

**Responsabilités :**
1. Vider complètement `algolia_access_level_projection`
2. Remplir avec UNIQUEMENT les records de la source modifiée
3. Déclencher Task Algolia `22394099-b71a-48ef-9453-e790b3159ade`

**Avantage :** Au lieu de mettre à jour 625k records, ne met à jour que la source concernée (~17k max).

## Garanties du système

### ✅ Préservation des assignations lors d'un import admin
Quand un admin réimporte une source (ex: CBAM), `refresh_ef_all_for_source` reconstruit `assigned_workspace_ids` depuis `fe_source_workspace_assignments`. Les assignations manuelles sont donc toujours préservées.

### ✅ Préservation des imports users
`refresh_ef_all_for_source` réinsère systématiquement les records de `user_factor_overlays` après les records globaux. Les imports personnels ne sont jamais perdus.

### ✅ Gestion optimisée des grandes sources
La fonction SQL `fill_algolia_assignments_projection` utilise un `INSERT SELECT` qui gère efficacement les sources de 6k, 17k records ou plus. La table tampon est vidée avant chaque utilisation, évitant l'accumulation de données obsolètes.

### ✅ Idempotence Algolia
La Task Algolia effectue des "Partial record updates" : elle met à jour uniquement `assigned_workspace_ids` sur les records existants, sans les recréer. Les opérations peuvent être rejouées sans effet de bord.

### ✅ Asynchrone et robuste
La Task Algolia s'exécute de manière asynchrone. Pas de timeout côté Edge Function. La synchronisation est déléguée à Algolia qui la gère de manière fiable.

## Flux de données complets

### Scénario 1 : Assignation simple

```
Admin UI: Assigner CBAM au workspace "Global Administration"
    ↓
assignFeSourceToWorkspace('CBAM', 'global-admin-uuid')
    ↓
schedule-source-reindex (action: 'assign')
    ↓
1. INSERT INTO fe_source_workspace_assignments
2. refresh_ef_all_for_source('CBAM')
   → DELETE WHERE Source = 'CBAM'
   → INSERT 6963 records (avec assigned_workspace_ids = ['global-admin-uuid'])
3. fill_algolia_assignments_projection('CBAM')
   → DELETE FROM algolia_source_assignments_projection (vide la table)
   → INSERT 6963 records dans projection (INSERT SELECT optimisé)
4. TRIGGER Task Algolia (f3cd3fd0-2db4-...)
    ↓
Algolia indexe 6963 records avec assigned_workspace_ids mis à jour
```

### Scénario 2 : Import admin avec assignations existantes

```
Admin UI: Importer nouveau CSV pour CBAM
    ↓
run_import_from_staging()
    ↓
1. TRUNCATE emission_factors
2. INSERT nouveaux records (7500 records au lieu de 6963)
3. Pour chaque source → refresh_ef_all_for_source('CBAM')
   → DELETE WHERE Source = 'CBAM'
   → INSERT 7500 records
   → LIT fe_source_workspace_assignments
   → RECONSTRUIT assigned_workspace_ids = ['global-admin-uuid'] ✅
   → RÉINSÈRE overlays users ✅
4. Trigger Task Algolia principale (419f86b4-...)
    ↓
Algolia contient 7500 records CBAM
Assignations préservées
Imports users préservés
```

### Scénario 3 : Changement access_level d'une source

```
Admin UI: Changer INIES de 'paid' à 'free'
    ↓
UPDATE fe_sources SET access_level = 'free' WHERE source_name = 'INIES'
    ↓
Trigger: trigger_algolia_on_access_level_change
    ↓
1. DELETE FROM algolia_access_level_projection
2. INSERT INTO algolia_access_level_projection
   SELECT "ID_FE", "Source", 'free'
   FROM emission_factors_all_search
   WHERE "Source" = 'INIES'
   → 17 189 records insérés (au lieu de 625k)
3. TRIGGER Task Algolia 22394099-b71a-48ef-9453-e790b3159ade
    ↓
Algolia met à jour UNIQUEMENT les 17k records INIES
Gain: 97% de réduction (625k → 17k)
```

### Scénario 4 : Bulk assignation

```
Admin UI: Assigner CBAM, Eco-Platform, Ember au workspace X
    ↓
syncWorkspaceAssignments('workspace-x', ['CBAM', 'Eco-Platform', 'Ember'], [])
    ↓
Boucle:
  - assignFeSourceToWorkspace('CBAM', 'workspace-x')
  - assignFeSourceToWorkspace('Eco-Platform', 'workspace-x')
  - assignFeSourceToWorkspace('Ember', 'workspace-x')
    ↓
3 appels à schedule-source-reindex (séquentiels)
    ↓
Algolia: 3 Tasks déclenchées
```

## Migration depuis l'ancien système

### Ancien flux (SUPPRIMÉ)
- ❌ `manage-fe-source-assignments` : Appels directs Algolia API
- ❌ `manage-fe-source-assignments-bulk` : Gestion bulk synchrone
- ❌ Problèmes : Timeouts, bugs pagination, perte de records

### Nouveau flux (ACTUEL)
- ✅ `schedule-source-reindex` : Flux unifié via Task Algolia
- ✅ Robuste : Pagination + asynchrone + idempotence
- ✅ Préservation garantie : Assignations + imports users

## Tests de validation

### Test 1 : Assignation simple
```bash
# Assigner CBAM au workspace Global Administration
# Vérifier dans Algolia : facetFilters sur assigned_workspace_ids
# Attendre 30s pour la Task
# Compter les hits: doit être 6963
```

### Test 2 : Import admin
```bash
# Assigner CBAM au workspace X
# Faire un import admin de CBAM (nouveau CSV)
# Vérifier que l'assignation au workspace X est toujours là
```

### Test 3 : Import user
```bash
# User A importe 50 facteurs perso (source: CBAM)
# Admin réimporte CBAM
# Vérifier que les 50 facteurs perso de User A sont toujours là
```

### Test 4 : Bulk assignation
```bash
# Assigner 5 sources en bulk
# Vérifier que toutes sont synchronisées dans Algolia
# Vérifier les counts pour chaque source
```

## Monitoring et debugging

### Logs Edge Function
```bash
supabase functions logs schedule-source-reindex --project-ref wrodvaatdujbpfpvrzge
```

### Vérifier la projection
```sql
SELECT source_name, COUNT(*) 
FROM algolia_source_assignments_projection 
GROUP BY source_name;
```

### Vérifier les assignations
```sql
SELECT fs.source_name, COUNT(fsa.workspace_id) as workspace_count
FROM fe_sources fs
LEFT JOIN fe_source_workspace_assignments fsa ON fs.source_name = fsa.source_name
GROUP BY fs.source_name;
```

### Task Algolia status
Dashboard Algolia → Data sources → Task `f3cd3fd0-2db4-49fa-be67-6bd88cbc5950` → Runs

## Références

- **Migration initiale :** `supabase/migrations/20251001_refonte_import_admin.sql`
- **Edge Function :** `supabase/functions/schedule-source-reindex/index.ts`
- **Frontend API :** `src/lib/adminApi.ts`
- **Documentation troubleshooting :** `docs/troubleshooting/cbam-records-loss-FINAL-SOLUTION.md` (historique)

