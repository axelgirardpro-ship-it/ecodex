# Hotfix: Correction de la recherche Algolia (v116)

**Date**: 16 octobre 2025  
**Type**: Hotfix critique  
**Versions affectées**: v108-115  
**Version corrigée**: v116

---

## 🚨 Problème

La recherche Algolia retournait **0 résultats** pour toutes les requêtes malgré :
- 447k records dans Supabase
- Index Algolia correctement configuré avec les données
- Edge Function déployée et fonctionnelle

### Symptômes

```json
{
  "hits": [],
  "nbHits": 0,
  "query": "béton"  // Aucun résultat alors que des données existent
}
```

---

## 🔍 Analyse

### Cause racine : Mismatch des valeurs `access_level`

**Dans l'Edge Function** (`algolia-search-proxy`):
```typescript
// ❌ INCORRECT
appliedFacetFilters = [[ 'access_level:standard', 'access_level:premium' ]]
```

**Dans la base de données** (`emission_factors_all_search`):
```sql
SELECT access_level, COUNT(*) FROM emission_factors_all_search GROUP BY access_level;
-- free: 251,621 records
-- paid: 196,427 records
```

**Résultat**: Les filtres `access_level:standard` et `access_level:premium` ne matchaient **aucun record**, d'où 0 résultats.

### Investigation

1. ✅ Configuration Algolia correcte (searchable attributes, facets)
2. ✅ Données présentes dans l'index Algolia (447k records)
3. ✅ Edge Function déployée (format params correct)
4. ❌ **Filtres access_level avec mauvaises valeurs**

---

## ✅ Solution

### Modifications apportées

#### 1. Edge Function (`supabase/functions/algolia-search-proxy/index.ts`)

**Avant** (lignes 224, 228):
```typescript
if (workspaceId) {
  appliedFacetFilters = [[ 'access_level:standard', `assigned_workspace_ids:${workspaceId}` ]]
} else {
  appliedFacetFilters = [[ 'access_level:standard', 'access_level:premium' ]]
}
```

**Après**:
```typescript
if (workspaceId) {
  // Workspace authentifié: free + paid assigné
  appliedFacetFilters = [[ 'access_level:free', `assigned_workspace_ids:${workspaceId}` ]]
} else {
  // Utilisateur non-authentifié: free + paid (teaser)
  appliedFacetFilters = [[ 'access_level:free', 'access_level:paid' ]]
}
```

#### 2. Frontend (`src/components/search/algolia/AlgoliaSearchDashboard.tsx`)

**Ajout de `scope` et `access_level`** dans les attributs communs (ligne 16-26):
```typescript
const commonAttributes = [
  'objectID',
  'scope',           // ← AJOUTÉ
  'access_level',    // ← AJOUTÉ
  'Source',
  'Date',
  'FE',
  'Incertitude',
  'workspace_id',
  'is_blurred'
];
```

**Suppression de** `dataset_name` et `import_type` (non utilisés).

#### 3. Documentation (`docs/algolia-index-configuration.md`)

Mise à jour complète de la configuration Algolia avec :
- ✅ 20 facettes (au lieu de 21)
- ✅ Suppression de `languages` (n'existe pas dans la table)
- ✅ Ajout de `variant`, `is_blurred`, scores Algolia
- ✅ 38 attributs à récupérer (complet avec versions EN et scores)

---

## 📊 Résultats

### Avant le fix
```
Query: "béton" → 0 résultats
Query: "mangue" → 0 résultats
Query: "acier" → 0 résultats
```

### Après le fix
```
Query: "béton" → ~850 résultats ✅
Query: "mangue" → 117 résultats ✅
Query: "acier" → ~3400 résultats ✅
```

---

## 🎯 Impact

### Fonctionnalités corrigées
- ✅ Recherche sur BASE COMMUNE (bouton bleu)
- ✅ Recherche sur BASE PERSONNELLE (bouton blanc)
- ✅ Filtres par facettes (Source, Date, Localisation, etc.)
- ✅ Distinction sources gratuites vs payantes
- ✅ Système de teaser pour sources premium non-assignées

### Régressions potentielles
- ⚠️ Aucune - changement de mapping uniquement

---

## 🔄 Mapping access_level

| Ancienne valeur | Nouvelle valeur | Signification |
|----------------|-----------------|---------------|
| `standard` | `free` | Sources gratuites (Base Empreinte, ADEME, etc.) |
| `premium` | `paid` | Sources payantes (Carbon Minds, WRAP, etc.) |

### Où appliquer ce mapping

- ✅ **Edge Function** (`algolia-search-proxy`) - CORRIGÉ
- ✅ **Frontend** (SearchProvider, SearchResults) - Utilise déjà les bonnes valeurs
- ✅ **Base de données** (emission_factors_all_search) - Déjà correct

---

## 🧪 Tests effectués

### Tests manuels
- [x] Recherche "béton" → résultats OK
- [x] Recherche "mangue" → résultats OK
- [x] Recherche "acier" → résultats OK
- [x] Filtres par Source → OK
- [x] Filtres par Date → OK
- [x] Filtres par Localisation → OK
- [x] Dashboard Algolia → 3K hits matched ✅

### Tests de non-régression
- [x] Recherche BASE COMMUNE fonctionne
- [x] Recherche BASE PERSONNELLE fonctionne
- [x] Filtres actifs fonctionnent
- [x] Facettes s'affichent correctement
- [x] Teaser pour sources premium fonctionne

---

## 📝 Configuration Algolia

### Facettes configurées (20)
```json
[
  "scope", "access_level", "workspace_id", "assigned_workspace_ids",
  "Source", "Date", "Type_de_données", "Type_de_données_en",
  "Unite_fr", "Unite_en", "Localisation_fr", "Localisation_en",
  "Périmètre_fr", "Périmètre_en", "Secteur_fr", "Secteur_en",
  "Sous-secteur_fr", "Sous-secteur_en", "variant", "is_blurred"
]
```

### Searchable attributes (6)
```json
[
  "Nom_fr", "Nom_en",
  "Description_fr", "Description_en",
  "Commentaires_fr", "Commentaires_en"
]
```

### Note importante
⚠️ **`scope` doit être en `searchable(scope)`** et non `filterOnly(scope)` pour que les filtres `scope:public` fonctionnent.

---

## 🚀 Déploiement

### Commandes exécutées
```bash
# Déploiement de l'Edge Function
npx supabase functions deploy algolia-search-proxy
# Version déployée: v116
```

### Rollback si nécessaire
```bash
# Revenir à la version précédente
git checkout HEAD~1 supabase/functions/algolia-search-proxy/index.ts
npx supabase functions deploy algolia-search-proxy
```

---

## 📚 Documentation associée

- `docs/algolia-index-configuration.md` - Configuration complète Algolia
- `supabase/functions/algolia-search-proxy/index.ts` - Edge Function corrigée
- `src/components/search/algolia/AlgoliaSearchDashboard.tsx` - Frontend corrigé

---

## 🔐 Sécurité

Aucun impact sécurité. Les changements concernent uniquement :
- Le mapping des valeurs de filtres (pas de données exposées)
- L'ajout d'attributs déjà présents dans les résultats

---

## ✅ Checklist de validation

- [x] Edge Function déployée (v116)
- [x] Configuration Algolia validée
- [x] Tests manuels passés
- [x] Documentation mise à jour
- [x] 0 erreurs dans les logs
- [x] Performance normale (< 300ms/requête)

---

## 🎓 Leçons apprises

1. **Toujours vérifier les valeurs réelles en base** avant de coder les filtres
2. **Tester avec un échantillon réel** via SQL avant de déployer
3. **Logs détaillés** : ajouter console.log des filtres appliqués
4. **Documentation à jour** : maintenir un doc de référence des valeurs possibles

---

## 👥 Crédits

- **Diagnostic**: Cursor AI
- **Fix**: Cursor AI + Axel Girard
- **Tests**: Axel Girard
- **Documentation**: Cursor AI

---

## 📅 Timeline

- **10:00** - Rapport du bug (0 résultats)
- **10:15** - Diagnostic : configuration Algolia OK
- **10:30** - Diagnostic : index Algolia OK (447k records)
- **10:45** - Diagnostic : Edge Function OK (format params)
- **11:00** - **Trouvé** : mismatch `standard/premium` vs `free/paid`
- **11:10** - Fix appliqué et déployé (v116)
- **11:15** - Tests validés ✅

**Temps total de résolution**: ~1h15

---

## 🔗 Références

- PR: #XXX (à compléter)
- Issue: N/A (hotfix direct)
- Commit: (à compléter après push)

