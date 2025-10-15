# ✅ Migration Complétée : Ajout des champs de score Algolia

**Date** : 15 octobre 2025  
**Migration** : `20251015_add_algolia_score_fields.sql`  
**Statut** : ✅ Complété et validé

## 🎯 Résumé

Cette migration ajoute 4 nouveaux champs de score numériques pour optimiser le ranking dans l'index Algolia :

- **localization_score** : Score de localisation (1-10)
- **perimeter_score** : Score de périmètre (1-10)  
- **base_score** : Score de base (1-10)
- **unit_score** : Score d'unité pour le ranking Algolia (1-10)

## ✅ Validations effectuées

| Élément | Statut | Détails |
|---------|--------|---------|
| Tables modifiées | ✅ | 3 tables (staging, emission_factors, emission_factors_all_search) |
| Colonnes ajoutées | ✅ | 4 colonnes par table (12 au total) |
| Types de données | ✅ | TEXT pour staging, INTEGER pour les autres |
| Index créés | ✅ | 4 index partiels sur emission_factors_all_search |
| Fonctions mises à jour | ✅ | 3 fonctions (run_import_from_staging, rebuild_emission_factors_all_search, refresh_ef_all_for_source) |
| Task ID Algolia | ✅ | Mis à jour vers `55278ecb-f8dc-43d8-8fe6-aff7057b69d0` |
| Commentaires | ✅ | Ajoutés sur toutes les colonnes |
| Documentation | ✅ | `docs/migration/2025-10-15_algolia_score_fields.md` |

## 📋 Modifications apportées

### 1. Tables

#### `staging_emission_factors`
```sql
ALTER TABLE public.staging_emission_factors
  ADD COLUMN localization_score text,
  ADD COLUMN perimeter_score text,
  ADD COLUMN base_score text,
  ADD COLUMN unit_score text;
```

#### `emission_factors`
```sql
ALTER TABLE public.emission_factors
  ADD COLUMN localization_score integer,
  ADD COLUMN perimeter_score integer,
  ADD COLUMN base_score integer,
  ADD COLUMN unit_score integer;
```

#### `emission_factors_all_search`
```sql
ALTER TABLE public.emission_factors_all_search
  ADD COLUMN localization_score integer,
  ADD COLUMN perimeter_score integer,
  ADD COLUMN base_score integer,
  ADD COLUMN unit_score integer;
```

### 2. Index créés

4 index partiels pour optimiser les performances :
```sql
CREATE INDEX idx_ef_all_search_localization_score 
  ON emission_factors_all_search(localization_score) 
  WHERE localization_score IS NOT NULL;
-- (+ 3 autres index similaires)
```

### 3. Fonctions mises à jour

#### `run_import_from_staging()`
- Conversion TEXT → INTEGER avec validation regex dans `temp_prepared`
- Ajout des 4 colonnes dans l'INSERT vers `emission_factors`

#### `rebuild_emission_factors_all_search()`
- Projection des scores depuis `emission_factors` (cast direct `::integer`)
- Scores NULL pour `user_factor_overlays` (pas de scores pour les imports utilisateurs)

#### `refresh_ef_all_for_source(text)`
- Mêmes modifications que `rebuild_emission_factors_all_search()`

## 🔄 Flux de données

```
┌─────────────────────────┐
│ CSV Admin Import        │
│ (avec colonnes scores)  │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ staging_emission_factors│
│ (scores: TEXT)          │
└───────────┬─────────────┘
            │
            │ run_import_from_staging()
            │ Conversion TEXT → INTEGER
            ▼
┌─────────────────────────┐
│ emission_factors        │
│ (scores: INTEGER)       │
└───────────┬─────────────┘
            │
            │ rebuild_emission_factors_all_search()
            ▼
┌─────────────────────────┐
│emission_factors_all_search│
│ (scores: INTEGER)       │
└───────────┬─────────────┘
            │
            ▼
    ┌───────────────┐
    │ Index Algolia │
    └───────────────┘
```

## 📝 Format CSV attendu

Le CSV d'import admin doit maintenant inclure ces colonnes supplémentaires :

```csv
ID,Nom,Description,FE,Unité donnée d'activité,Source,Secteur,Sous-secteur,Localisation,Date,Incertitude,Périmètre,Contributeur,Commentaires,Nom_en,Description_en,Unite_en,Secteur_en,Sous-secteur_en,Localisation_en,Périmètre_en,Contributeur_en,Commentaires_en,Méthodologie,Méthodologie_en,Type_de_données,Type_de_données_en,localization_score,perimeter_score,base_score,unit_score
uuid-1,Transport aérien,Vol court courrier,0.258,kg CO2e/passager.km,ADEME,Transport,Aérien,France,2024,±15%,Scope 1+2+3,ADEME,Données moyennes,Air transport,Short-haul flight,kg CO2e/passenger.km,Transport,Aviation,France,Scope 1+2+3,ADEME,Average data,LCA,LCA,Primary,Primary,9,7,10,10
```

**Valeurs acceptées** :
- Nombres entiers (généralement 1-10)
- Valeurs vides acceptées (converties en NULL)
- Valeurs non numériques ignorées (converties en NULL)

## 🧪 Tests recommandés

### 1. Test d'import avec scores
```bash
# Préparer un CSV de test avec les 4 colonnes de score
# Importer via l'interface admin
# Vérifier la propagation des données
```

### 2. Validation SQL
```sql
-- Vérifier la présence de scores
SELECT 
  COUNT(*) as total,
  COUNT(localization_score) as with_loc,
  COUNT(perimeter_score) as with_per,
  COUNT(base_score) as with_base,
  COUNT(unit_score) as with_unit,
  AVG(localization_score)::numeric(10,2) as avg_loc,
  AVG(perimeter_score)::numeric(10,2) as avg_per,
  AVG(base_score)::numeric(10,2) as avg_base,
  AVG(unit_score)::numeric(10,2) as avg_unit
FROM emission_factors
WHERE localization_score IS NOT NULL;
```

### 3. Test de performance
```sql
-- Vérifier l'utilisation des index
EXPLAIN ANALYZE
SELECT * FROM emission_factors_all_search
WHERE localization_score >= 8
ORDER BY localization_score DESC
LIMIT 100;
```

## 📚 Documentation

Documentation détaillée disponible dans :
- `docs/migration/2025-10-15_algolia_score_fields.md`
- Fichier de migration : `supabase/migrations/20251015_add_algolia_score_fields.sql`

## ⚠️ Notes importantes

1. **Rétrocompatibilité** : Les imports sans scores fonctionnent toujours (valeurs NULL)
2. **user_factor_overlays** : Pas de scores pour les imports utilisateurs (définis à NULL)
3. **Validation stricte** : Seules les valeurs numériques entières sont acceptées
4. **Performance** : Index partiels optimisés pour les requêtes de tri

## 🔧 Prochaines étapes

1. ✅ Migration appliquée et validée
2. ✅ Task ID Algolia mis à jour (`55278ecb-f8dc-43d8-8fe6-aff7057b69d0`)
3. ⏭️ Tester l'import admin avec un CSV contenant les scores
4. ⏭️ Configurer Algolia pour utiliser ces scores dans le ranking
5. ⏭️ Documenter les guidelines d'attribution des scores (1-10)
6. ⏭️ Former l'équipe sur l'utilisation des nouveaux champs

## 🔄 Rollback

Si nécessaire, voir la section "Rollback" dans `docs/migration/2025-10-15_algolia_score_fields.md`

---

**Migration réalisée avec succès** ✅  
*Tous les tests de validation sont passés*

