# Architecture : Flux d'assignation de sources premium

## Vue d'ensemble

Ce document décrit le flux d'assignation de sources premium aux workspaces, utilisant le système de Task Algolia pour garantir robustesse et cohérence.

## Architecture globale

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
│  3. POPULATE algolia_source_assignments_projection (paginé)      │
│  4. TRIGGER Algolia Task ID                                      │
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

##### Étape 4 : Nettoyage de la table de projection Algolia
```typescript
await supabase
  .from("algolia_source_assignments_projection")
  .delete()
  .neq("id_fe", "impossible-uuid-to-match-all");
```

##### Étape 5 : Population de la projection avec pagination
```typescript
let allRecords: any[] = [];
let page = 0;
const pageSize = 1000;

while (hasMore) {
  const { data } = await supabase
    .from("emission_factors_all_search")
    .select("ID_FE, Source, assigned_workspace_ids")
    .eq("Source", source_name)
    .range(page * pageSize, (page + 1) * pageSize - 1);
  
  allRecords = allRecords.concat(data);
  page++;
}
```

**Important :** La pagination est cruciale pour gérer les sources volumineuses (6k+, 17k+ records).

##### Étape 6 : Déclenchement de la Task Algolia
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
**Rôle :** Table temporaire pour alimenter la Task Algolia.

| Colonne | Type | Description |
|---------|------|-------------|
| `id_fe` | text | Identifiant unique du facteur d'émission |
| `source_name` | text | Nom de la source |
| `assigned_workspace_ids` | uuid[] | Liste des workspaces assignés |
| `updated_at` | timestamptz | Date de dernière mise à jour |

**Cycle de vie :**
1. Vidée avant chaque assignation
2. Remplie avec tous les records de la source
3. Lue par la Task Algolia
4. Reste en place pour traçabilité

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

## Garanties du système

### ✅ Préservation des assignations lors d'un import admin
Quand un admin réimporte une source (ex: CBAM), `refresh_ef_all_for_source` reconstruit `assigned_workspace_ids` depuis `fe_source_workspace_assignments`. Les assignations manuelles sont donc toujours préservées.

### ✅ Préservation des imports users
`refresh_ef_all_for_source` réinsère systématiquement les records de `user_factor_overlays` après les records globaux. Les imports personnels ne sont jamais perdus.

### ✅ Pagination pour grandes sources
La Edge Function pagine les résultats par tranches de 1000 records, permettant de gérer des sources de 6k, 17k records ou plus sans timeout.

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
3. TRUNCATE algolia_source_assignments_projection
4. INSERT 6963 records dans projection (paginé: 7 batches de 1000)
5. TRIGGER Task Algolia (f3cd3fd0-2db4-...)
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

### Scénario 3 : Bulk assignation

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

