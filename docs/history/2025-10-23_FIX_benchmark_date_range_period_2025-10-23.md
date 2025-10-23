# FIX - Période du Benchmark (dateRange) toujours vide
**Date** : 2025-10-23  
**Type** : 🐛 Bug Fix  
**Criticité** : Moyenne  

---

## 🐛 Problème

Le champ **"Période"** dans le bloc "Informations sur le benchmark" affichait toujours **"-"** (rien), même quand des dates étaient filtrées dans la recherche.

### Symptôme
```
Période: -
```
Au lieu de :
```
Période: 2022          (si une seule date filtrée)
Période: 2020 - 2023   (si plusieurs dates filtrées)
```

---

## 🔍 Analyse du Bug

### Cause Racine : Champ fantôme `Publication`

L'Edge Function `generate-benchmark` demandait et utilisait un champ **`Publication`** qui **n'existe pas** dans l'index Algolia.

#### Dans Algolia (structure réelle)
```typescript
// ✅ Champs qui EXISTENT
"Date": integer          // Année de validité du facteur d'émission
"Source": text
"Unite_fr": text
// ...

// ❌ Champ qui N'EXISTE PAS
"Publication": ???       // N'existe pas dans la base !
```

#### Dans l'Edge Function (code bugué)
```typescript
// Ligne 307 : Demande un champ qui n'existe pas
attributesToRetrieve: [
  'FE', 
  'Source',
  'Publication',  // ❌ N'existe pas !
  'Date',
  // ...
],

// Ligne 417 : Calcul de dateRange sur un champ vide
const years = [...new Set(validHits.map((h: any) => h.Publication).filter(Boolean))];
// → years = [] (tableau vide car h.Publication est toujours undefined)

// Ligne 459-462 : dateRange toujours null
dateRange: years.length > 0 ? {
  min: Math.min(...years),
  max: Math.max(...years),
} : null,
// → dateRange = null (car years.length === 0)
```

#### Dans le frontend
```typescript
// BenchmarkMetadata.tsx ligne 55-57
{metadata.dateRange && metadata.dateRange.min && metadata.dateRange.max
  ? `${metadata.dateRange.min} - ${metadata.dateRange.max}`
  : '-'}
// → Affiche toujours '-' car dateRange est null
```

---

## ✅ Solution Implémentée

### 1. Suppression du champ fantôme `Publication`

```typescript
// ❌ AVANT - Ligne 241
facets: ['Unite_fr', 'Périmètre_fr', 'Source', 'Publication'],

// ✅ APRÈS
facets: ['Unite_fr', 'Périmètre_fr', 'Source', 'Date'],

// ❌ AVANT - Ligne 307
attributesToRetrieve: [
  'FE', 
  'Source', 
  'Publication',  // Supprimé
  'Date',
  // ...
],

// ✅ APRÈS
attributesToRetrieve: [
  'FE', 
  'Source', 
  'Date',
  // ...
],
```

### 2. Extraction des dates depuis les facetFilters actifs

Au lieu de parcourir tous les hits, on extrait les **valeurs filtrées** directement depuis les `facetFilters` envoyés par le frontend.

```typescript
// Extraire les dates actives depuis les facetFilters (valeurs filtrées par l'utilisateur)
let activeDates: number[] = [];
if (allFacetFilters && Array.isArray(allFacetFilters)) {
  allFacetFilters.forEach((filterGroup: any) => {
    if (Array.isArray(filterGroup)) {
      filterGroup.forEach((filter: string) => {
        if (filter.startsWith('Date:')) {
          const dateValue = parseInt(filter.replace('Date:', ''), 10);
          if (!isNaN(dateValue)) {
            activeDates.push(dateValue);
          }
        }
      });
    } else if (typeof filterGroup === 'string' && filterGroup.startsWith('Date:')) {
      const dateValue = parseInt(filterGroup.replace('Date:', ''), 10);
      if (!isNaN(dateValue)) {
        activeDates.push(dateValue);
      }
    }
  });
}

// Dédupliquer et trier les dates
const years = [...new Set(activeDates)].sort((a, b) => a - b);
```

### 3. Simplification des transformations

```typescript
// ❌ AVANT
Date: hit.Date || hit.Publication || null,
date: hit.Date || hit.Publication || null,

// ✅ APRÈS
Date: hit.Date || null,
date: hit.Date || null,
```

---

## 📊 Résultats

### Avant (bugué) ❌
```
Requête: voiture
Unité: km
Périmètre: Combustion
Taille de l'échantillon: 1 Source
Période: -                          ❌ Toujours vide
```

### Après (corrigé) ✅
```
Cas 1 - Aucune date filtrée:
Période: -

Cas 2 - Une seule date filtrée (ex: 2022):
Période: 2022                       ✅

Cas 3 - Plusieurs dates filtrées (ex: 2020, 2021, 2022):
Période: 2020 - 2022                ✅
```

---

## 🎯 Logique d'Affichage

| Dates filtrées | Comportement | Affichage |
|----------------|--------------|-----------|
| Aucune | `dateRange = null` | `-` |
| Une seule (ex: 2022) | `dateRange = { min: 2022, max: 2022 }` | `2022` |
| Plusieurs (ex: 2020, 2022) | `dateRange = { min: 2020, max: 2022 }` | `2020 - 2022` |

---

## 🔧 Fichiers Modifiés

### Edge Function
- `supabase/functions/generate-benchmark/index.ts` :
  - Ligne 241 : `'Publication'` → `'Date'` dans facettes
  - Ligne 307 : Suppression de `'Publication'` des attributs
  - Lignes 380, 399 : Simplification `hit.Date || hit.Publication` → `hit.Date`
  - Lignes 418-441 : **Nouvelle logique** d'extraction des dates depuis `facetFilters`

### Documentation
- `FIX_benchmark_date_range_period_2025-10-23.md` : Ce document

---

## ✅ Tests de Validation

- [x] Benchmark sans filtre de date → Période: `-`
- [x] Benchmark avec une seule date (2022) → Période: `2022`
- [x] Benchmark avec plusieurs dates (2020-2023) → Période: `2020 - 2023`
- [x] Déploiement Edge Function v1.1.0
- [x] Test en production confirmé

---

## 🎓 Leçons Apprises

### ⚠️ Toujours vérifier la structure réelle des données

Le champ `Publication` n'existait **nulle part** dans :
- ❌ La table PostgreSQL `emission_factors`
- ❌ La vue matérialisée Algolia
- ❌ L'index Algolia `ef_all`

**Mais** il était utilisé dans l'Edge Function → bug silencieux qui retournait toujours des valeurs vides.

### ✅ Pattern recommandé

Pour les facettes/filtres, toujours :
1. **Extraire depuis les `facetFilters`** (valeurs filtrées activement)
2. **Pas depuis les hits** (plus lent, peut contenir des valeurs non filtrées)

---

**Version Edge Function** : v1.1.0  
**Impact** : Affichage correct de la période dans les benchmarks  
**Risque** : ✅ Aucun (correction de bug uniquement, pas de changement de logique métier)

