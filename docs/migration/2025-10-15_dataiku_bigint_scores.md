# Note technique : Gestion des scores en BIGINT depuis Dataiku

**Date** : 2025-10-15  
**Type** : Adaptation technique  
**Statut** : ✅ Résolu

## Contexte

Le flow Dataiku écrase la table `staging_emission_factors` et impose le type `bigint` pour les 4 colonnes de score :
- `localization_score`
- `perimeter_score`
- `base_score`
- `unit_score`

## Problème initial

La migration initiale (`20251015_add_algolia_score_fields.sql`) avait créé ces colonnes en type `text` pour cohérence avec les autres colonnes de staging. Cependant, Dataiku écrase complètement la table lors de chaque import et recrée les colonnes de score en `bigint`.

## Solution implémentée

La fonction `run_import_from_staging()` a été adaptée pour gérer directement le type `bigint` :

```sql
-- Conversion directe bigint → integer
localization_score::integer AS localization_score,
perimeter_score::integer AS perimeter_score,
base_score::integer AS base_score,
unit_score::integer AS unit_score
```

### Pourquoi ça fonctionne ?

- PostgreSQL permet de caster `bigint` vers `integer` sans problème tant que la valeur est dans la plage des entiers (-2147483648 à 2147483647)
- Les scores Algolia sont des valeurs 1-10, donc bien dans cette plage
- Le cast est sûr et performant

## Types de données à travers le flux

```
Dataiku (CSV)
    ↓ (bigint)
staging_emission_factors
    ↓ (cast ::integer)
temp_prepared (table temporaire)
    ↓ (integer)
emission_factors
    ↓ (integer)
emission_factors_all_search
    ↓ (integer)
Algolia Index
```

## Autres corrections appliquées

### 1. Échappement de l'apostrophe

Le nom de colonne `"Unité donnée d'activité"` contient une apostrophe qui causait des problèmes d'échappement. Solution :

```sql
-- Utilisation de chr(39) pour représenter l'apostrophe
"Unité donnée d' || chr(39) || 'activité"
```

### 2. Utilisation de EXECUTE pour SQL dynamique

Pour éviter les problèmes d'échappement complexes dans les noms de colonnes, la fonction utilise maintenant `EXECUTE` avec des requêtes SQL dynamiques construites avec `chr(39)`.

## Validation

### Test de compatibilité des types

```sql
-- Vérifier que le cast bigint → integer fonctionne
SELECT 
  localization_score,
  localization_score::integer as as_integer,
  pg_typeof(localization_score) as original_type,
  pg_typeof(localization_score::integer) as cast_type
FROM staging_emission_factors
LIMIT 5;
```

Résultat attendu :
- `original_type`: `bigint`
- `cast_type`: `integer`
- Valeurs préservées sans perte

### Test d'import complet

```sql
-- Exécuter l'import
SELECT public.run_import_from_staging();

-- Vérifier que les scores sont bien présents
SELECT 
  COUNT(*) as total,
  COUNT(localization_score) as with_loc_score,
  AVG(localization_score)::numeric(10,2) as avg_loc_score
FROM emission_factors;
```

## Impact

### ✅ Avantages de cette approche

1. **Compatible avec Dataiku** : Accepte le type `bigint` imposé par Dataiku
2. **Pas de migration de données** : Pas besoin de convertir 448K lignes
3. **Performance** : Le cast `bigint::integer` est très rapide
4. **Robuste** : Fonctionne que les colonnes soient en `text`, `bigint` ou `integer`

### ⚠️ Limitations

- La valeur maximale est limitée à 2147483647 (limite d'un INTEGER)
- Pour les scores 1-10, cette limitation n'est pas un problème

## Conclusion

La fonction `run_import_from_staging()` est maintenant compatible avec le comportement de Dataiku qui écrase la table staging avec des colonnes `bigint` pour les scores. Le cast direct `::integer` est simple, performant et sûr pour notre cas d'usage.

## Fichiers modifiés

- Migration : `handle_bigint_scores_from_dataiku` (appliquée via MCP)
- Documentation : `docs/migration/2025-10-15_dataiku_bigint_scores.md`

## Prochaines étapes

1. ✅ Fonction adaptée pour gérer bigint
2. ⏭️ Tester l'import avec Dataiku
3. ⏭️ Vérifier la propagation des scores vers Algolia

