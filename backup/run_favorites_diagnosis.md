# Guide de diagnostic et nettoyage des favoris orphelins

## Problème identifié

Les filtres de la page `/favoris` ne fonctionnent plus à cause de favoris historiques qui contiennent des `item_id` correspondant aux anciens objectID de l'index `emission_factors`. Ces IDs n'existent plus dans les nouveaux index `ef_public_fr` et `ef_private_fr`.

## Solution implémentée

1. **Migration vers les filtres Algolia** : La page `/favoris` utilise maintenant les composants Algolia (`FavorisSearchProvider`, `FavorisSearchBox`, `FavorisSearchFilters`, `FavorisSearchResults`) au lieu du filtrage côté client.

2. **Filtrage par favoriteIds** : Les requêtes Algolia sont automatiquement filtrées pour ne montrer que les éléments dont l'`objectID` correspond aux favoris de l'utilisateur.

3. **Migration SQL** : Script SQL pour identifier, tenter de remapper, et nettoyer les favoris orphelins.

## Étapes de diagnostic et nettoyage

### 1. Diagnostic (sans modification)

```sql
-- Exécuter dans Supabase SQL Editor pour comprendre l'ampleur du problème
\i backup/diagnose_favorites_issue.sql
```

### 2. Appliquer la migration de nettoyage

```sql
-- Appliquer la migration qui crée les fonctions de nettoyage
\i supabase/migrations/20250812124655_cleanup_orphan_favorites.sql
```

### 3. Tester le remapping et nettoyage

```sql
-- Voir les favoris orphelins avant traitement
SELECT * FROM identify_orphan_favorites() LIMIT 10;

-- Exécuter le nettoyage complet avec rapport
SELECT full_favorites_cleanup();
```

### 4. Vérification post-nettoyage

```sql
-- Vérifier qu'il n'y a plus de favoris orphelins
SELECT COUNT(*) as remaining_orphans FROM identify_orphan_favorites();

-- Vérifier le nombre total de favoris valides
SELECT 
  COUNT(*) as total_valid_favorites
FROM favorites f
WHERE f.item_type = 'emission_factor'
AND (
  EXISTS (SELECT 1 FROM emission_factors_public_search_fr pub WHERE pub.object_id = f.item_id)
  OR EXISTS (SELECT 1 FROM emission_factors_private_search_fr priv WHERE priv.object_id = f.item_id)
);
```

## Prévention des futurs problèmes

1. **Tests des nouveaux favoris** : Les nouveaux favoris utilisent les objectID des nouveaux index.
2. **Contraintes de FK** : Considérer ajouter des contraintes pour éviter les favoris orphelins à l'avenir.
3. **Monitoring** : Script de monitoring pour détecter les favoris orphelins automatiquement.

## Rollback en cas de problème

Si le nettoyage cause des problèmes :

```sql
-- Les favoris supprimés ne peuvent pas être restaurés automatiquement
-- Utiliser la sauvegarde pg_dump créée avant la migration
-- Ou demander aux utilisateurs de re-ajouter leurs favoris depuis la recherche
```

## Notes techniques

- Les filtres Algolia permettent une recherche plus rapide et cohérente
- Le filtrage par `objectID` garantit que seuls les favoris valides sont affichés
- La migration SQL tente de remapper les favoris basés sur nom+source+FE avant suppression
- Les logs de debug permettent de suivre le fonctionnement des filtres en développement
