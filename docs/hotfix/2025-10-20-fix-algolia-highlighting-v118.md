# 🎯 HOTFIX: Correction du highlighting Algolia incomplet

**Date**: 20 octobre 2025  
**Version Edge Function**: v118  
**Criticité**: Haute - Impact utilisateur direct  
**Status**: ✅ Résolu

---

## 📋 Résumé Exécutif

Le highlighting des mots-clés recherchés ne s'appliquait que sur les premiers résultats de chaque page (environ 17 sur 25), créant une expérience utilisateur incohérente. La cause racine était que l'Edge Function `algolia-search-proxy` ne transmettait pas le paramètre `attributesToHighlight` à Algolia.

---

## 🔍 Symptômes Observés

### Comportement Problématique
- ✅ Highlighting fonctionnel sur les 17 premiers résultats
- ❌ Highlighting absent sur les résultats 18-25
- ✅ Highlighting fonctionnel sur les premiers résultats de la page 2
- ❌ Highlighting absent sur les derniers résultats de la page 2

### Exemple Concret
Recherche "mangue" avec 25 résultats par page :
- Résultats 1-17 : "**Mangue** crue" (surligné)
- Résultats 18-25 : "Mangue crue" (pas de surligné)

---

## 🔬 Analyse Technique

### Cause Racine Identifiée

**Edge Function `algolia-search-proxy/index.ts` (ligne 253-296)**

L'Edge Function extrayait les paramètres de la requête mais **omettait** `attributesToHighlight` :

```typescript
// ❌ AVANT : attributesToHighlight non extrait
const {
  query,
  filters,
  facetFilters,
  // ... autres paramètres
  restrictSearchableAttributes
} = r || {}
```

Le paramètre n'était donc jamais transmis à Algolia, qui appliquait sa limite par défaut de highlighting sur un nombre restreint de hits.

### Impact sur le Système

1. **Frontend** : Configure correctement `attributesToHighlight` via `<Configure>`
2. **Edge Function** : Ne transmettait PAS le paramètre à Algolia
3. **Algolia** : Utilisait sa configuration par défaut (highlighting limité)

---

## ✅ Solution Implémentée

### 1. Edge Function - Extraction du Paramètre

**Fichier**: `supabase/functions/algolia-search-proxy/index.ts`  
**Ligne**: 268

```typescript
// ✅ APRÈS : attributesToHighlight extrait
const {
  query,
  filters,
  facetFilters,
  facets,
  maxValuesPerFacet,
  sortFacetValuesBy,
  maxFacetHits,
  ruleContexts,
  origin: reqOrigin,
  searchType,
  hitsPerPage,
  page,
  attributesToRetrieve: attrsClient,
  attributesToHighlight,  // ✅ AJOUTÉ
  restrictSearchableAttributes
} = r || {}
```

### 2. Edge Function - Transmission à Algolia

**Fichier**: `supabase/functions/algolia-search-proxy/index.ts`  
**Ligne**: 293

```typescript
const paramsObj: Record<string, any> = {
  query: query || '',
  filters: combinedFilters,
  facetFilters: combinedFacetFilters.length > 0 ? combinedFacetFilters : undefined,
  ...(attributesToRetrieve ? { attributesToRetrieve } : (attrsClient ? { attributesToRetrieve: attrsClient } : {})),
  ...(typeof hitsPerPage === 'number' ? { hitsPerPage } : {}),
  ...(typeof page === 'number' ? { page } : {}),
  ...(restrictSearchableAttributes ? { restrictSearchableAttributes } : {}),
  ...(facets ? { facets } : {}),
  maxValuesPerFacet: typeof maxValuesPerFacet === 'number' ? maxValuesPerFacet : 1500,
  ...(sortFacetValuesBy ? { sortFacetValuesBy } : {}),
  ...(typeof maxFacetHits === 'number' ? { maxFacetHits } : {}),
  ...(Array.isArray(ruleContexts) ? { ruleContexts } : {}),
  ...(Array.isArray(attributesToHighlight) && attributesToHighlight.length > 0 ? { attributesToHighlight } : {}), // ✅ AJOUTÉ
  // Balises de highlight attendues par React InstantSearch
  highlightPreTag: '__ais-highlight__',
  highlightPostTag: '__/ais-highlight__'
}
```

### 3. Frontend - Correction Bug React Hooks

**Fichier**: `src/components/search/algolia/SearchResults.tsx`

**Problème** : Hook `useSearchBox()` appelé à l'intérieur d'une fonction helper, violant les règles des hooks React.

**Solution** : Extraction du hook au niveau du composant

```typescript
// ❌ AVANT : Hook appelé dans une fonction helper (ligne 346)
const getHighlightedText = (hit: AlgoliaHit, base: string) => {
  // ...
  const { query } = useSearchBox(); // ❌ INTERDIT : Hook dans une fonction
  // ...
}

// ✅ APRÈS : Hook au niveau du composant (ligne 189)
export const SearchResults: React.FC = () => {
  const { hits: originalHits } = useHits<AlgoliaHit>();
  const { query } = useSearchBox(); // ✅ CORRECT : Hook au niveau racine
  // ...
  
  const getHighlightedText = (hit: AlgoliaHit, base: string) => {
    // Utilise directement 'query' de la closure
    const searchTerm = (query || '').trim().toLowerCase();
    // ...
  };
}
```

**Erreur corrigée** : `"Rendered more hooks than during the previous render"`

---

## 🧪 Tests de Validation

### Scénarios Testés

| Scénario | Résultat Attendu | Status |
|----------|------------------|--------|
| Recherche "mangue" - 25 résultats/page | Tous les 25 résultats surlignés | ✅ |
| Page 2 de la recherche | Tous les résultats surlignés | ✅ |
| Changement de langue (FR/EN) | Highlighting sur attributs localisés | ✅ |
| Recherche sur Description/Commentaires | Highlighting sur tous les attributs configurés | ✅ |

### Configuration Finale

**Frontend** (`AlgoliaSearchDashboard.tsx`)
```typescript
const highlightAttributes = language === 'en'
  ? ['Nom_en', 'Nom', 'Description_en', 'Description', 'Commentaires_en', 'Commentaires']
  : ['Nom_fr', 'Nom', 'Description_fr', 'Description', 'Commentaires_fr', 'Commentaires'];

const base = {
  // ...
  attributesToHighlight: highlightAttributes as string[],
  // ...
};
```

**Backend** (Edge Function v118)
- ✅ Transmet `attributesToHighlight` à Algolia
- ✅ Préserve tous les autres paramètres existants
- ✅ Compatible avec le système de cache

---

## 📊 Impact Métier

### Avant
- Expérience utilisateur incohérente
- Difficulté à scanner visuellement les résultats
- Confusion sur les résultats pertinents

### Après
- ✅ Highlighting uniforme sur **TOUS** les résultats
- ✅ Meilleure UX de recherche
- ✅ Utilisation native d'Algolia (pas de solution "on-top")
- ✅ Performance optimale (pas de traitement client supplémentaire)

---

## 🚀 Déploiement

### Edge Function
```bash
# Déployé via MCP Supabase
Version: 118
Status: ACTIVE
```

### Frontend
```bash
# Changements dans SearchResults.tsx
# Hot reload automatique en développement
# Build production à venir
```

---

## 📚 Leçons Apprises

1. **Toujours valider la transmission des paramètres bout-en-bout** (Frontend → Edge Function → API)
2. **Les hooks React doivent TOUJOURS être appelés au niveau racine** d'un composant
3. **Privilégier les solutions natives** (Algolia highlighting) plutôt que des workarounds client
4. **Tester sur plusieurs pages de résultats** pour détecter les limitations de pagination

---

## 🔗 Références

- [Documentation Algolia - attributesToHighlight](https://www.algolia.com/doc/api-reference/api-parameters/attributesToHighlight/)
- [React Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
- Mémoire utilisateur #9584241 : Privilégier les outils MCP

---

## ✅ Validation Finale

- [x] Edge Function déployée (v118)
- [x] Bug React Hooks corrigé
- [x] Tests manuels validés
- [x] Documentation complète
- [x] Prêt pour merge

**Approuvé pour production** ✅

