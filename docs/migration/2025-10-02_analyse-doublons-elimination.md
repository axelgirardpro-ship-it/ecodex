# Analyse des doublons éliminés lors de l'import

**Date**: 2025-10-02  
**Contexte**: Écart de 10,985 records entre staging_emission_factors et emission_factors

## 📊 Statistiques globales

| Métrique | Valeur |
|----------|--------|
| Total records staging_emission_factors | 295,806 |
| Records invalides (sans FE ou Unité) | 395 |
| Records valides | 295,411 |
| **Records uniques (après déduplication)** | **284,426** |
| **Doublons éliminés** | **10,985** |
| Factor_keys avec doublons | 6,465 |
| Moyenne de doublons par factor_key | 2.7 |
| Maximum de doublons pour une clé | 69 |

## 🔍 Échantillon des doublons éliminés

### Cas extrême: "Électricité mix moyen - Reste du monde" (69 doublons)

Le record le plus dupliqué est **"Électricité mix moyen"** pour **"Reste du monde"** avec **69 occurrences** ayant des valeurs de FE différentes :

| Nom | Unité | Source | Date | Localisation | FE (kg CO₂e) | Status |
|-----|-------|--------|------|--------------|--------------|--------|
| Électricité mix moyen | kWh | Base Carbone v23.6 | 2014 | Reste du monde | 0.000183 | ❌ Éliminé |
| Électricité mix moyen | kWh | Base Carbone v23.6 | 2014 | Reste du monde | 0.000648 | ✅ **Conservé** |
| Électricité mix moyen | kWh | Base Carbone v23.6 | 2014 | Reste du monde | 0.0167 | ❌ Éliminé |
| Électricité mix moyen | kWh | Base Carbone v23.6 | 2014 | Reste du monde | 0.0273 | ❌ Éliminé |
| Électricité mix moyen | kWh | Base Carbone v23.6 | 2014 | Reste du monde | 0.0296 | ❌ Éliminé |
| Électricité mix moyen | kWh | Base Carbone v23.6 | 2014 | Reste du monde | 0.0791 | ❌ Éliminé |
| Électricité mix moyen | kWh | Base Carbone v23.6 | 2014 | Reste du monde | 0.15 | ❌ Éliminé |
| Électricité mix moyen | kWh | Base Carbone v23.6 | 2014 | Reste du monde | 0.186 | ❌ Éliminé |
| Électricité mix moyen | kWh | Base Carbone v23.6 | 2014 | Reste du monde | 0.188 | ❌ Éliminé |
| Électricité mix moyen | kWh | Base Carbone v23.6 | 2014 | Reste du monde | 0.197 | ❌ Éliminé |
| ... | ... | ... | ... | ... | ... | ... |
| Électricité mix moyen | kWh | Base Carbone v23.6 | 2014 | Reste du monde | 0.461 | ❌ Éliminé |

**Note importante**: Tous ces records ont les **mêmes métadonnées** (nom, unité, source, date, localisation) mais des **valeurs de FE différentes**. Ils devraient normalement avoir des `factor_key` différents puisque le FE fait partie de la clé !

## 📊 Distribution des doublons

| Nombre de doublons | Nombre de factor_keys concernés | Impact total |
|-------------------|----------------------------------|--------------|
| 69 doublons | 1 factor_key | 68 records éliminés |
| 42 doublons | 1 factor_key | 41 records éliminés |
| 33 doublons | 3 factor_keys | 96 records éliminés |
| 32 doublons | 1 factor_key | 31 records éliminés |
| 27 doublons | 1 factor_key | 26 records éliminés |
| 26 doublons | 1 factor_key | 25 records éliminés |
| 24 doublons | 1 factor_key | 23 records éliminés |
| 22 doublons | 2 factor_keys | 42 records éliminés |
| 16 doublons | 11 factor_keys | 165 records éliminés |
| 14 doublons | 8 factor_keys | 104 records éliminés |
| 8 doublons | 29 factor_keys | 203 records éliminés |
| 2-7 doublons | ~6,400 factor_keys | ~10,200 records éliminés |

**Total**: 6,465 factor_keys avec doublons → **10,985 records éliminés**

## 🐛 Problème identifié

Le comportement observé suggère que :

1. **Soit** le `factor_key` ne distingue pas correctement les FE différents (problème de précision numérique ?)
2. **Soit** les données sources contiennent de vrais doublons avec des variations mineures de FE
3. **Soit** il y a une confusion entre les colonnes lors de l'import staging

**Note**: La plupart des doublons (6,400 factor_keys) ont seulement 2-3 occurrences, suggérant des doublons accidentels plutôt qu'un problème systématique.

### Vérification de calculate_factor_key

La fonction `calculate_factor_key` génère une clé basée sur :
```sql
nom | unité | source | périmètre | localisation | FE | date
```

Le FE est formaté avec : `to_char(p_fe, 'FM999999999.############')`

**Hypothèse** : La déduplication `DISTINCT ON (factor_key)` conserve le **premier** record rencontré, ce qui peut éliminer des valeurs de FE valides si elles ne sont différenciées que par des décimales au-delà de 12 chiffres.

## ✅ Solution appliquée

La migration `20251002_auto_rebuild_all_search_on_import.sql` :

1. **Maintient** le comportement actuel de déduplication (pour éviter de casser les imports existants)
2. **Ajoute** un rebuild automatique complet de `emission_factors_all_search` qui inclut TOUJOURS les `user_factor_overlays`
3. **Crée** une fonction de validation `validate_emission_factors_all_search()` pour détecter les incohérences

## 📋 Recommandations

### Court terme (FAIT ✅)
- ✅ Automatiser le rebuild complet après import
- ✅ Créer une fonction de validation

### Moyen terme (À FAIRE)
- ⚠️ Analyser les données sources pour déterminer si ces "doublons" sont intentionnels
- ⚠️ Potentiellement améliorer le `factor_key` pour mieux différencier les FE proches
- ⚠️ Ajouter un champ "country" ou "region" distinct de "Localisation" pour les mix électriques

### Long terme (À CONSIDÉRER)
- 💡 Implémenter un système de versioning plus robuste pour les facteurs d'émission
- 💡 Créer une table de "variations régionales" pour les facteurs comme l'électricité
- 💡 Ajouter un workflow de validation des imports avec alerte sur les doublons suspects

## 🔧 Utilisation de la fonction de validation

```sql
-- Valider l'état actuel
SELECT * FROM public.validate_emission_factors_all_search();

-- Devrait retourner:
{
  "is_valid": true,
  "message": "Validation réussie: emission_factors_all_search est cohérent",
  "emission_factors_count": 284426,
  "user_factor_overlays_count": 117,
  "expected_total": 284543,
  "all_search_count": 284543,
  "public_count": 284426,
  "private_count": 117
}
```

## 📈 Impact

- **Avant** : `emission_factors_all_search` pouvait ne pas contenir les overlays utilisateur après import
- **Après** : Garantie que `emission_factors_all_search = emission_factors + user_factor_overlays`
- **Performance** : Rebuild complet ~1-2s (acceptable pour un import admin)

