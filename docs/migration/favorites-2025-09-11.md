# Migration Favoris — 2025-09-11

## Contexte

- Les favoris ajoutés lors des imports privés utilisaient un `item_id` composite (`workspace|factor_key`), ce qui empêchait:
  - l'affichage dans la page Favoris (filtre par `objectID` côté Algolia),
  - le flag "favori" sur la page Search (comparaison par `objectID`).
- De plus, le filtre Algolia côté favoris ne quotait pas les `objectID`, provoquant des erreurs `filters: Unexpected token numeric(...)`.

## Changements

1. Frontend
   - `src/lib/algolia/searchClient.ts`: `buildFavoriteIdsFilter()` quote maintenant les `objectID` → `objectID:"<uuid>"`.

2. SQL (Supabase)
   - `public.add_import_overlays_to_favorites(user_id, workspace_id, dataset_name)`:
     - Retourne `jsonb` `{ inserted, updated_legacy }`.
     - Insère dans `public.favorites` avec `item_id = user_batch_algolia.object_id` et `item_data` cohérent.
     - Remap (update) des entrées legacy (item_id composite) vers des `objectID` réels lorsqu'un matching est possible via `calculate_factor_key(...)`.

3. Opérations
   - Nettoyage ciblé des favoris legacy pour le dataset "Import 2 du 11 Septembre" (user dev): suppression des entrées avec `item_id` contenant `|`.

## Impact

- Les favoris issus des imports privés sont visibles dans la page Favoris et correctement flaggués dans la page Search.
- Plus d'erreur de parsing Algolia sur les filtres favoris.

## Vérification

```sql
-- Vérifier le nombre de favoris par dataset
select count(*) from public.favorites f
join auth.users u on u.id = f.user_id
where u.email = 'axelgirard.pro+dev@gmail.com'
  and f.item_type = 'emission_factor'
  and (f.item_data->>'dataset_name') = 'Import 2 du 11 Septembre';

-- Forcer l'ajout après import (appel depuis Edge)
select public.add_import_overlays_to_favorites('<user_id>'::uuid, '<workspace_id>'::uuid, 'Nom Dataset');
```

## Notes

- Les imports futurs appellent automatiquement la RPC avec le flag UI "Ajouter aux favoris".
- Si des datasets historiques restent en legacy, exécuter la RPC avec le `dataset_name` pour remapper et/ou supprimer les composites.


