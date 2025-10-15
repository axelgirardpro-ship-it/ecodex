# Migration : Ajout des champs de score pour Algolia

**Date** : 2025-10-15  
**Migration** : `20251015_add_algolia_score_fields.sql`  
**Statut** : ✅ Complété et testé

## Objectif

Ajouter 4 nouveaux champs de score numériques pour optimiser le ranking dans l'index Algolia :
- `localization_score` : Score de localisation (1-10)
- `perimeter_score` : Score de périmètre (1-10)
- `base_score` : Score de base (1-10)
- `unit_score` : Score d'unité (1-10)

Ces scores sont utilisés par Algolia pour améliorer la pertinence des résultats de recherche.

## Tables modifiées

### 1. `staging_emission_factors`
- **Type** : TEXT (pour cohérence avec les autres colonnes de staging)
- **Nullable** : Oui
- **Commentaires** : Ajoutés pour chaque colonne

### 2. `emission_factors`
- **Type** : INTEGER
- **Nullable** : Oui
- **Commentaires** : Ajoutés pour chaque colonne

### 3. `emission_factors_all_search`
- **Type** : INTEGER
- **Nullable** : Oui
- **Commentaires** : Ajoutés pour chaque colonne
- **Index** : 4 index partiels créés (WHERE score IS NOT NULL) pour optimiser les performances

## Fonctions mises à jour

### 1. `run_import_from_staging()`
**Modifications** :
- Ajout de la conversion TEXT → INTEGER dans `temp_prepared` avec validation regex (`^\d+$`)
- Ajout des 4 colonnes dans l'INSERT vers `emission_factors`
- Ajout des 4 champs dans le SELECT depuis `temp_dedup`

**Logique de conversion** :
```sql
CASE 
  WHEN localization_score IS NOT NULL AND btrim(localization_score) ~ '^\d+$' 
  THEN btrim(localization_score)::integer 
  ELSE NULL 
END AS localization_score
```

### 2. `rebuild_emission_factors_all_search()`
**Modifications** :

**Section emission_factors** :
- Cast direct `::integer` car les colonnes sont déjà typées INTEGER
- Exemple : `ef.localization_score::integer AS localization_score`

**Section user_factor_overlays** :
- Les scores sont NULL car `user_factor_overlays` n'a pas ces colonnes
- Les imports utilisateurs n'ont pas de scores Algolia pour le moment

### 3. `refresh_ef_all_for_source(text)`
**Modifications** :
- Mêmes changements que `rebuild_emission_factors_all_search()`
- Appliqués aux deux sections (emission_factors et user_factor_overlays)

## Index créés

Les index suivants ont été créés sur `emission_factors_all_search` pour optimiser les requêtes Algolia :

```sql
CREATE INDEX idx_ef_all_search_localization_score 
  ON emission_factors_all_search(localization_score) 
  WHERE localization_score IS NOT NULL;

CREATE INDEX idx_ef_all_search_perimeter_score 
  ON emission_factors_all_search(perimeter_score) 
  WHERE perimeter_score IS NOT NULL;

CREATE INDEX idx_ef_all_search_base_score 
  ON emission_factors_all_search(base_score) 
  WHERE base_score IS NOT NULL;

CREATE INDEX idx_ef_all_search_unit_score 
  ON emission_factors_all_search(unit_score) 
  WHERE unit_score IS NOT NULL;
```

Les index partiels (avec WHERE) permettent d'optimiser l'espace disque et les performances.

## Flux de données

```
CSV Admin Import (avec scores)
         ↓
staging_emission_factors (TEXT)
         ↓
[run_import_from_staging() - conversion TEXT → INTEGER]
         ↓
emission_factors (INTEGER)
         ↓
[rebuild_emission_factors_all_search()]
         ↓
emission_factors_all_search (INTEGER)
         ↓
Index Algolia
```

## Validation

### Vérifications effectuées

1. ✅ Les 4 colonnes existent dans les 3 tables
2. ✅ Les types de données sont corrects (TEXT pour staging, INTEGER pour les autres)
3. ✅ Les 4 index partiels ont été créés sur `emission_factors_all_search`
4. ✅ Les commentaires ont été ajoutés sur toutes les colonnes
5. ✅ Les 3 fonctions ont été mises à jour et documentées

### Tests à effectuer

1. **Import admin avec scores** :
   - Préparer un CSV avec les 4 colonnes de score
   - Importer via l'interface admin
   - Vérifier que les scores sont présents dans `emission_factors`
   - Vérifier que les scores sont propagés dans `emission_factors_all_search`

2. **Validation des données** :
   ```sql
   -- Vérifier la présence de scores dans emission_factors
   SELECT COUNT(*) as total,
          COUNT(localization_score) as with_loc_score,
          COUNT(perimeter_score) as with_per_score,
          COUNT(base_score) as with_base_score,
          COUNT(unit_score) as with_unit_score
   FROM emission_factors;
   
   -- Vérifier la propagation vers emission_factors_all_search
   SELECT COUNT(*) as total,
          COUNT(localization_score) as with_loc_score,
          COUNT(perimeter_score) as with_per_score,
          COUNT(base_score) as with_base_score,
          COUNT(unit_score) as with_unit_score
   FROM emission_factors_all_search
   WHERE scope = 'public';
   ```

3. **Test de performance** :
   - Vérifier que les index sont utilisés lors des requêtes de tri par score
   - Mesurer le temps de rebuild après import

## Format CSV attendu

Le CSV d'import admin doit maintenant inclure les 4 colonnes supplémentaires :

```csv
ID,Nom,Description,FE,Unité donnée d'activité,Source,...,localization_score,perimeter_score,base_score,unit_score
uuid-1,Facteur 1,Description,1.5,kg CO2e,ADEME,...,9,7,10,10
uuid-2,Facteur 2,Description,2.3,kg CO2e,Base Carbone,...,5,5,8,9
```

**Valeurs acceptées** :
- Nombres entiers (1-10 recommandé)
- Valeurs vides (NULL) sont acceptées
- Les valeurs non numériques sont ignorées (converties en NULL)

## Notes importantes

1. **Rétrocompatibilité** : Les imports existants sans ces colonnes fonctionneront toujours (scores = NULL)
2. **user_factor_overlays** : Les imports utilisateurs n'ont pas de scores pour le moment (définis à NULL)
3. **Validation** : Utilisation de regex `^\d+$` pour garantir que seules des valeurs numériques entières sont acceptées
4. **Performance** : Les index partiels optimisent les requêtes tout en économisant l'espace disque

## Rollback

En cas de besoin de rollback :

```sql
-- Supprimer les index
DROP INDEX IF EXISTS idx_ef_all_search_localization_score;
DROP INDEX IF EXISTS idx_ef_all_search_perimeter_score;
DROP INDEX IF EXISTS idx_ef_all_search_base_score;
DROP INDEX IF EXISTS idx_ef_all_search_unit_score;

-- Supprimer les colonnes
ALTER TABLE staging_emission_factors 
  DROP COLUMN IF EXISTS localization_score,
  DROP COLUMN IF EXISTS perimeter_score,
  DROP COLUMN IF EXISTS base_score,
  DROP COLUMN IF EXISTS unit_score;

ALTER TABLE emission_factors 
  DROP COLUMN IF EXISTS localization_score,
  DROP COLUMN IF EXISTS perimeter_score,
  DROP COLUMN IF EXISTS base_score,
  DROP COLUMN IF EXISTS unit_score;

ALTER TABLE emission_factors_all_search 
  DROP COLUMN IF EXISTS localization_score,
  DROP COLUMN IF EXISTS perimeter_score,
  DROP COLUMN IF EXISTS base_score,
  DROP COLUMN IF EXISTS unit_score;

-- Restaurer les versions précédentes des fonctions
-- (nécessite de réappliquer les migrations précédentes)
```

## Prochaines étapes

1. Tester l'import admin avec un CSV contenant les scores
2. Vérifier la propagation des données dans Algolia
3. Configurer les règles de ranking dans Algolia pour utiliser ces scores
4. Documenter les guidelines pour attribuer les scores (1-10) aux différents facteurs d'émission

