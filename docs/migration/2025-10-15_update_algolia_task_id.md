# Mise à jour du Task ID Algolia

**Date** : 2025-10-15  
**Type** : Mise à jour de configuration  
**Statut** : ✅ Complété

## Changement effectué

Le Task ID Algolia utilisé dans la fonction `run_import_from_staging()` a été mis à jour.

### Ancien Task ID
```
419f86b4-4c35-4608-8a88-b8343a457a3a
```

### Nouveau Task ID
```
55278ecb-f8dc-43d8-8fe6-aff7057b69d0
```

## Fonction modifiée

### `run_import_from_staging()`

**Ligne modifiée** :
```sql
-- Avant
PERFORM public.run_algolia_data_task('419f86b4-4c35-4608-8a88-b8343a457a3a'::uuid, 'eu');

-- Après
PERFORM public.run_algolia_data_task('55278ecb-f8dc-43d8-8fe6-aff7057b69d0'::uuid, 'eu');
```

## Impact

- Cette modification affecte uniquement l'appel à la tâche Algolia lors des imports admin
- Le nouveau Task ID sera utilisé pour tous les imports futurs
- Aucun impact sur les données existantes
- Aucune modification de schéma de base de données

## Validation

✅ Le nouveau Task ID est présent dans la fonction  
✅ L'ancien Task ID n'est plus présent dans la fonction  
✅ Le commentaire de la fonction a été mis à jour  
✅ Le fichier de migration a été mis à jour

## Fichiers modifiés

1. Migration appliquée via MCP Supabase
2. `supabase/migrations/20251015_add_algolia_score_fields.sql` (commentaire mis à jour)
3. Documentation : `docs/migration/2025-10-15_update_algolia_task_id.md`

## Vérification

Pour vérifier que le changement est actif :

```sql
SELECT 
  pg_get_functiondef(p.oid) LIKE '%55278ecb-f8dc-43d8-8fe6-aff7057b69d0%' as nouveau_task_id_present,
  pg_get_functiondef(p.oid) LIKE '%419f86b4-4c35-4608-8a88-b8343a457a3a%' as ancien_task_id_present
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' 
  AND p.proname = 'run_import_from_staging';
```

Résultat attendu :
- `nouveau_task_id_present`: `true`
- `ancien_task_id_present`: `false`

## Notes

Cette mise à jour garantit que les imports admin utilisent la bonne tâche Algolia configurée pour le projet.

