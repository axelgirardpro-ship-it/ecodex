# 🎯 PHASE 3 - React Components Type Safety

**Branche:** `fix/lint-phase3-react-components`  
**Objectif:** Éliminer tous les `any` types restants dans les composants React

---

## 📊 État actuel

### Lints restants

| Catégorie | Nombre | Priorité |
|-----------|--------|----------|
| `@typescript-eslint/no-explicit-any` | ~60 erreurs | 🔴 CRITIQUE |
| `react-hooks/exhaustive-deps` | ~6 warnings | 🟡 MOYEN |
| `react-hooks/rules-of-hooks` | 1 erreur | 🔴 CRITIQUE |
| `react-refresh/only-export-components` | ~8 warnings | 🟢 FAIBLE |

---

## 🗂️ Fichiers à corriger (par priorité)

### 🔴 Priorité CRITIQUE

#### 1. `/src/components/search/favoris/FavorisSearchBox.tsx`
**Erreur:** `React Hook "useSearchControls" is called conditionally`
- [ ] Déplacer `useSearchControls` au top level
- [ ] Ajouter gestion d'erreur si contexte non disponible

#### 2. `/src/components/search/algolia/SearchProvider.tsx` (6 `any`)
**Erreurs:** Multiple `any` types dans le provider principal
- [ ] Typer les requêtes Algolia
- [ ] Typer les réponses Algolia
- [ ] Typer les états de recherche

#### 3. `/src/components/search/algolia/SearchResults.tsx` (16 `any`)
**Erreurs:** Beaucoup de `any` dans le rendu des résultats
- [ ] Typer les hits Algolia
- [ ] Typer les facets
- [ ] Typer les highlights

---

### 🟡 Priorité MOYENNE

#### 4. `/src/components/admin/ContactsTable.tsx` (4 `any` + 2 hooks deps)
- [ ] Typer les contacts
- [ ] Corriger useEffect dependencies

#### 5. `/src/components/admin/SourceWorkspaceAssignments.tsx` (4 `any`)
- [ ] Typer les assignations workspace
- [ ] Typer les sources

#### 6. `/src/components/search/favoris/FavorisSearchResults.tsx` (5 `any`)
- [ ] Typer les résultats favoris
- [ ] Typer les filtres

#### 7. `/src/components/benchmark/BenchmarkStatistics.tsx` (3 `any`)
- [ ] Typer les statistiques
- [ ] Typer les données de graphique

---

### 🟢 Priorité FAIBLE

#### 8. Autres fichiers avec 1-2 `any`
- `/src/components/admin/EmissionFactorAccessManager.tsx` (1 `any`)
- `/src/components/admin/FreemiumCompaniesTable.tsx` (1 `any`)
- `/src/components/admin/SourcesPanel.tsx` (1 `any`)
- `/src/components/admin/WorkspacesTable.tsx` (1 `any`)
- `/src/components/auth/PasswordReset.tsx` (1 `any`)
- `/src/components/debug/PerformanceMonitor.tsx` (1 `any`)
- `/src/components/search/AlgoliaErrorBoundary.tsx` (4 `any`)
- `/src/components/search/GenerateBenchmarkButton.tsx` (1 `any`)
- `/src/components/search/ResultsTable.tsx` (1 `any`)

---

## 🎯 Plan d'action

### Étape 1: Créer les types manquants
- [ ] Créer `src/types/admin.ts` pour les types admin
- [ ] Créer `src/types/benchmark.ts` pour les types benchmark
- [ ] Enrichir `src/types/algolia.ts` avec les types manquants

### Étape 2: Corriger les erreurs CRITIQUES
- [ ] FavorisSearchBox (hooks rules)
- [ ] SearchProvider (6 any)
- [ ] SearchResults (16 any)

### Étape 3: Corriger les erreurs MOYENNES
- [ ] ContactsTable
- [ ] SourceWorkspaceAssignments
- [ ] FavorisSearchResults
- [ ] BenchmarkStatistics

### Étape 4: Corriger les erreurs FAIBLES
- [ ] Tous les fichiers avec 1-2 any

### Étape 5: Warnings React Hooks
- [ ] Corriger exhaustive-deps
- [ ] Corriger react-refresh warnings (optionnel)

---

## 📝 Notes

### Types Algolia existants
Nous avons déjà créé dans `src/types/algolia.ts` :
- `AlgoliaHit`
- `SearchResponse`
- `SearchParams`
- `FacetFilters`
- etc.

Il faut les utiliser dans tous les composants React.

### Pattern à suivre

```typescript
// ❌ Avant
const handleClick = (item: any) => {
  console.log(item.Source)
}

// ✅ Après
import type { AlgoliaHit } from '@/types/algolia'

const handleClick = (item: AlgoliaHit) => {
  console.log(item.Source)
}
```

---

## 🎯 Objectif final

**0 erreurs ESLint `@typescript-eslint/no-explicit-any`**

---

## 🚀 Déploiement

Contrairement à la Phase 2 (Edge Functions), la Phase 3 concerne uniquement le frontend.
Pas besoin de déployer des Edge Functions, juste :
1. Commit + push
2. Créer PR
3. Merge vers main
4. Build frontend réussit

