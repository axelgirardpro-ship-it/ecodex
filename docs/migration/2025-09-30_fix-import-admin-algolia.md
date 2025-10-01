# 2025-09-30 – Correctifs Import Admin & Réindexation Algolia

## Résumé
Suite aux migrations du 29 septembre (nettoyage des colonnes `language`), la fonction `run_import_from_staging` a été corrigée pour :
1. Supprimer les références obsolètes au paramètre `p_language`
2. Corriger les comparaisons regex sur colonnes UUID
3. Restaurer le déclenchement automatique de la tâche Algolia après import admin

## Contexte
Lors d'un import admin depuis Dataiku, plusieurs erreurs bloquantes ont été identifiées :
- **Erreur 1** : `function calculate_factor_key(..., p_language => unknown, ...) does not exist`
- **Erreur 2** : `operator does not exist: uuid ~ unknown` dans `refresh_ef_all_for_source`
- **Problème 3** : La tâche Algolia n'était plus déclenchée automatiquement après l'import

## Migrations appliquées

### 1. `fix_calculate_factor_key_signature`
**Problème** : `calculate_factor_key` n'acceptait que 7 paramètres, mais était appelée avec 10 paramètres (incluant `p_fe`, `p_date` et `p_language`).

**Solution** :
- Ajout de `p_fe numeric DEFAULT NULL` et `p_date integer DEFAULT NULL`
- Conservation temporaire de `p_language` pour compatibilité

### 2. `remove_language_from_calculate_factor_key`
**Problème** : Le paramètre `p_language` est obsolète depuis la migration du 29/09/2025.

**Solution** :
- Suppression de `p_language` de la signature de `calculate_factor_key`
- Simplification du scope : uniquement `workspace_id` (plus de `language`)

**Signature finale** :
```sql
calculate_factor_key(
  p_nom text,
  p_unite text,
  p_source text,
  p_perimetre text,
  p_localisation text,
  p_workspace_id uuid,
  p_fe numeric DEFAULT NULL,
  p_date integer DEFAULT NULL
)
```

### 3. `fix_run_import_from_staging_remove_language`
Mise à jour de `run_import_from_staging` pour supprimer l'appel `p_language := NULL`.

### 4. `fix_remaining_functions_remove_language_param`
Correction de :
- `add_import_overlays_to_favorites`
- `batch_upsert_user_factor_overlays`

### 5. `fix_refresh_ef_all_for_source_uuid_cast`
**Problème** : Tentative d'utiliser l'opérateur regex `~` sur une colonne de type `uuid`.

**Solution** : Remplacement de la comparaison regex par un test simple :
```sql
-- AVANT
CASE WHEN ef.workspace_id ~ '^[0-9a-fA-F-]{36}$' THEN 'private' ELSE 'public' END

-- APRÈS
CASE WHEN ef.workspace_id IS NOT NULL THEN 'private' ELSE 'public' END
```

### 6. `fix_rebuild_emission_factors_all_search_uuid_cast`
Même correctif appliqué à `rebuild_emission_factors_all_search`.

### 7. `restore_auto_algolia_trigger_after_import`
**Problème** : La tâche Algolia n'était plus déclenchée automatiquement après l'import admin.

**Solution** : Restauration de l'appel automatique à la fin de `run_import_from_staging` :
```sql
-- Déclencher automatiquement l'ingestion Algolia (EU) après succès
PERFORM public.run_algolia_data_task('419f86b4-4c35-4608-8a88-b8343a457a3a'::uuid, 'eu');
```

## Flux d'import admin restauré

Quand `run_import_from_staging()` est appelé depuis Dataiku :

1. ✅ Traitement des données de `staging_emission_factors` (~296k enregistrements)
2. ✅ Nettoyage et validation (séparation valide/invalide)
3. ✅ Déduplication par `factor_key`
4. ✅ Création des sources dans `fe_sources`
5. ✅ Assignation automatique aux workspaces via `fe_source_workspace_assignments`
6. ✅ Insertion/mise à jour dans `emission_factors`
7. ✅ Rafraîchissement de `emission_factors_all_search` par source
8. ✅ **Déclenchement automatique de la tâche Algolia (EU)** 🆕
9. ✅ Retour des statistiques (inserted, invalid, sources, duration_ms)

## Impact

### Base de données
- ✅ `emission_factors_all_search` : 452 340 enregistrements publics + 117 privés
- ✅ Toutes les fonctions sont cohérentes (plus de référence à `language`)
- ✅ Les comparaisons UUID sont correctes

### Algolia
- ✅ Réindexation automatique après chaque import admin
- ✅ Task ID : `419f86b4-4c35-4608-8a88-b8343a457a3a`
- ✅ Région : EU
- ✅ Logs d'audit créés pour chaque déclenchement

## Tests
- ✅ Import admin depuis Dataiku : succès (295 806 enregistrements traités)
- ✅ Tâche Algolia déclenchée automatiquement et enregistrée dans `audit_logs`
- ✅ `emission_factors_all_search` à jour
- ✅ Aucune erreur SQL lors de l'exécution

## Vérification post-migration

Pour vérifier que tout fonctionne :

```sql
-- 1. Vérifier le nombre d'enregistrements
SELECT COUNT(*) as total, scope 
FROM public.emission_factors_all_search 
GROUP BY scope;

-- 2. Vérifier les derniers logs Algolia
SELECT action, details->>'task_id' as task_id, created_at
FROM public.audit_logs
WHERE action LIKE '%algolia%'
ORDER BY created_at DESC
LIMIT 5;

-- 3. Tester l'import (sur un petit échantillon)
SELECT public.run_import_from_staging();
```

## Notes techniques

### Paramètres `p_fe` et `p_date`
Ces paramètres sont acceptés pour compatibilité avec `run_import_from_staging` mais ne sont **pas utilisés** dans le calcul de la clé `factor_key`. Ils servent uniquement à identifier les enregistrements lors du traitement.

### Scope public/private
La logique de détermination du scope a été simplifiée :
- Si `workspace_id IS NOT NULL` → `scope = 'private'`
- Sinon → `scope = 'public'`

Cette simplification est plus robuste et évite les erreurs de type SQL.

## Suivi
- [x] Import admin fonctionnel
- [x] Tâche Algolia automatique
- [x] Toutes les fonctions corrigées
- [ ] Surveiller les performances de la tâche Algolia sur gros volumes
- [ ] Considérer l'ajout d'un retry automatique en cas d'échec Algolia




