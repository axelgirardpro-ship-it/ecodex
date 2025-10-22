# Audit Réseau - Recherche "mangue" sur la page /search
**Date**: 16 Octobre 2025  
**Requête**: "mangue"  
**Résultats**: 3093 résultats en 32ms  
**Durée totale de chargement**: ~3-5 secondes

---

## 🔴 PROBLÈMES CRITIQUES IDENTIFIÉS

### 1. **DUPLICATION MASSIVE DES REQUÊTES SUPABASE** 🚨

#### Problème : `search_quotas` - 32+ appels identiques
```
GET /rest/v1/search_quotas?select=*&user_id=eq.e6e2e278-14e9-44fd-86ff-28da775f43c6
```
**Nombre d'appels**: Au moins **32 fois** la même requête !

**Impact**: 
- Charge inutile sur Supabase
- Latence accrue
- Consommation de quota API
- Coût potentiel

**Cause probable**: 
- Hook `useQuotas` appelé par plusieurs composants sans mécanisme de cache global
- Pas de déduplication des requêtes
- Chaque composant déclenche sa propre requête

**Solution recommandée**:
```typescript
// Créer un singleton pour les quotas avec React Query
const { data: quotas } = useQuery({
  queryKey: ['search_quotas', userId],
  queryFn: () => fetchQuotas(userId),
  staleTime: 30000, // 30 secondes
  cacheTime: 60000, // 1 minute
});
```

---

#### Problème : `fe_sources` - 19+ appels identiques
```
GET /rest/v1/fe_sources?select=source_name%2Caccess_level%2Cis_global&is_global=eq.true
```
**Nombre d'appels**: Au moins **19 fois**

**Impact**:
- Charge inutile sur Supabase
- Données statiques qui ne changent pas fréquemment

**Cause probable**:
- Hook `useEmissionFactorAccess` appelé sans cache
- Chaque rendu déclenche une nouvelle requête

**Solution recommandée**:
```typescript
// Cache avec React Query et staleTime long
const { data: globalSources } = useQuery({
  queryKey: ['fe_sources', 'global'],
  queryFn: () => fetchGlobalSources(),
  staleTime: 300000, // 5 minutes (données rarement modifiées)
  cacheTime: 600000, // 10 minutes
});
```

---

#### Problème : `fe_source_workspace_assignments` - 18+ appels identiques
```
GET /rest/v1/fe_source_workspace_assignments?select=source_name&workspace_id=eq.de960863-892c-45e2-8288-b9bbc69bc03b
```
**Nombre d'appels**: Au moins **18 fois**

**Impact**:
- Redondance majeure
- Latence cumulée

**Solution recommandée**:
- Utiliser React Query avec cache
- Stale time de 60 secondes minimum

---

#### Problème : `is_supra_admin` - 10+ appels identiques
```
POST /rest/v1/rpc/is_supra_admin
```
**Nombre d'appels**: Au moins **10 fois**

**Impact**:
- Appel RPC coûteux répété inutilement
- Permissions utilisateur ne changent pas pendant la session

**Solution recommandée**:
```typescript
// Cache au niveau session avec React Query
const { data: isSupraAdmin } = useQuery({
  queryKey: ['is_supra_admin', userId],
  queryFn: () => checkSupraAdmin(),
  staleTime: Infinity, // Ne jamais revalider pendant la session
  cacheTime: Infinity,
});
```

---

#### Problème : `workspace_has_access` - Appels répétés
```
POST /rest/v1/rpc/workspace_has_access
```
**Nombre d'appels**: 2 fois (acceptable mais optimisable)

---

#### Problème : `search_quotas` POST (upserts) - 19+ appels
```
POST /rest/v1/search_quotas?on_conflict=user_id
```
**Nombre d'appels**: Au moins **19 fois**

**Impact**:
- Write operations très fréquentes
- Risque de race conditions
- Charge DB inutile

**Cause probable**:
- Synchronisation de quotas trop agressive
- Pas de debouncing sur les mises à jour

**Solution recommandée**:
- Implémenter un debounce de 5 secondes minimum
- Batching des mises à jour de quotas
- Utiliser un état local et synchroniser seulement à des moments clés

---

### 2. **REQUÊTES SUPABASE INUTILES AU CHARGEMENT**

#### Logos sources - requêtes trop fréquentes
```
POST /storage/v1/object/list/source-logos
GET /storage/v1/object/public/source-logos/Agribalyse%203.2.png
GET /storage/v1/object/public/source-logos/WRAP.svg
GET /storage/v1/object/public/source-logos/The%20Big%20Climate%20Database%20v1.2.png
GET /storage/v1/object/public/source-logos/ecoinvent%203.11.jpeg
```

**Solution**: 
- Mettre en cache les URLs de logos avec un TTL de 24h
- Utiliser un CDN ou cache navigateur agressif

---

### 3. **REQUÊTES ALGOLIA - OPTIMISATIONS POSSIBLES**

#### Proxy Algolia
```
POST /functions/v1/algolia-search-proxy (3 appels)
```

**Observations**:
- 3 appels à l'edge function pour une seule recherche
- Temps de réponse: correct mais optimisable

**Analyse**:
- Un appel initial (probablement pour les facets/stats)
- Deux autres appels (possiblement pour les résultats et les refinements)

**Optimisation recommandée**:
- Vérifier si les 3 appels sont vraiment nécessaires
- Possibilité de batching/multiplexing des requêtes Algolia

---

### 4. **ERREURS REALTIME SUPABASE**

```
[DEBUG] Realtime channel status CHANNEL_ERROR: quota-updates-...
```
**Répété plusieurs fois**

**Impact**: 
- Canal Realtime qui échoue en boucle
- Tentatives de reconnexion inutiles

**Solution**:
- Vérifier la configuration du canal Realtime
- Implémenter un backoff exponentiel sur les reconnexions
- Désactiver si non critique

---

## 📊 STATISTIQUES GLOBALES

### Requêtes Supabase REST API
- **Total estimé**: ~120-150 requêtes
- **GET search_quotas**: 32+
- **POST search_quotas**: 19+
- **GET fe_sources**: 19+
- **GET fe_source_workspace_assignments**: 18+
- **POST is_supra_admin**: 10+
- **Autres**: ~30

### Temps de chargement
- Requête Algolia: **32ms** (excellent ✅)
- Chargement page total: **3-5 secondes** (trop long ❌)
- Cause principale: **Waterfall de requêtes Supabase**

---

## 🎯 PLAN D'ACTION PRIORISÉ

### Priorité 1 - CRITIQUE (Impact élevé, effort moyen)

1. **Implémenter React Query pour tous les hooks Supabase**
   - Fichiers concernés:
     - `src/hooks/useQuotas.ts`
     - `src/hooks/useEmissionFactorAccess.ts`
     - `src/hooks/useSupraAdmin.ts`
   - Temps estimé: **2-3 heures**
   - Impact: **Réduction de 70% des requêtes**

2. **Débouncer les upserts de quotas**
   - Fichier: `src/hooks/useQuotaSync.ts`
   - Implémenter un debounce de 5 secondes
   - Temps estimé: **30 minutes**
   - Impact: **Réduction de 80% des POST quotas**

3. **Fixer les erreurs Realtime**
   - Fichier: `src/contexts/FavoritesContext.tsx` ou similaire
   - Implémenter un backoff exponentiel
   - Temps estimé: **1 heure**
   - Impact: **Moins de bruit dans la console, moins de tentatives inutiles**

### Priorité 2 - IMPORTANTE (Impact moyen, effort faible)

4. **Cache des logos de sources**
   - Fichier: `src/hooks/useSourceLogos.ts`
   - Utiliser React Query avec staleTime de 24h
   - Temps estimé: **30 minutes**
   - Impact: **Réduction de requêtes storage**

5. **Optimiser les appels Algolia proxy**
   - Fichier: `src/lib/algolia/unifiedSearchClient.ts`
   - Analyser si les 3 appels sont nécessaires
   - Temps estimé: **1-2 heures**
   - Impact: **Potentiel de réduction de 33% des appels edge function**

### Priorité 3 - NICE TO HAVE (Impact faible, effort élevé)

6. **Paralléliser les requêtes initiales**
   - Utiliser `Promise.all()` pour les appels indépendants
   - Temps estimé: **2-3 heures**
   - Impact: **Réduction du temps de chargement de 30%**

---

## 💡 RECOMMANDATIONS ARCHITECTURALES

### 1. **Adopter React Query globalement**
Remplacer les hooks custom par des hooks React Query:
```typescript
// ❌ Avant (multiple appels)
const useQuotas = () => {
  const [quotas, setQuotas] = useState(null);
  useEffect(() => {
    fetchQuotas().then(setQuotas);
  }, []);
  return quotas;
};

// ✅ Après (cache global)
const useQuotas = () => {
  return useQuery({
    queryKey: ['quotas', userId],
    queryFn: fetchQuotas,
    staleTime: 30000,
  });
};
```

### 2. **Centraliser la gestion du cache**
Créer un fichier `src/lib/queryClient.ts`:
```typescript
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 secondes par défaut
      cacheTime: 300000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

### 3. **Implémenter un système de debouncing global**
Créer un hook `useDebouncedMutation`:
```typescript
const useDebouncedUpsert = (delay = 5000) => {
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  return useCallback((fn: () => Promise<void>) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(fn, delay);
  }, [delay]);
};
```

---

## 📈 IMPACT ATTENDU APRÈS OPTIMISATIONS

| Métrique | Avant | Après | Amélioration |
|----------|-------|-------|--------------|
| Requêtes Supabase | ~150 | ~20-30 | **-80%** |
| Temps chargement | 3-5s | 1-2s | **-60%** |
| Requêtes POST quotas | 19+ | 1-2 | **-90%** |
| Erreurs console | Nombreuses | Minimales | **-95%** |

---

## 🔍 DÉTAILS TECHNIQUES SUPPLÉMENTAIRES

### Waterfall de requêtes observé
```
1. Auth (1 requête) ✅
2. Users (2 requêtes) ✅
3. is_supra_admin (10 requêtes) ❌ DUPLICATION
4. search_quotas (32+ requêtes) ❌ DUPLICATION MASSIVE
5. fe_sources (19+ requêtes) ❌ DUPLICATION
6. fe_source_workspace_assignments (18+ requêtes) ❌ DUPLICATION
7. Workspace (1 requête) ✅
8. Favorites (1 requête) ✅
9. Algolia search (3 requêtes via proxy) ⚠️ OPTIMISABLE
10. Logos (5 requêtes) ⚠️ OPTIMISABLE
```

### Pattern de requêtes à chaque render
Le pattern observé suggère que plusieurs composants déclenchent indépendamment les mêmes hooks, sans partage d'état global.

**Composants suspects** (à vérifier):
- `UnifiedNavbar.tsx` (utilise useQuotas, usePermissions)
- `SearchProvider.tsx` (utilise useEmissionFactorAccess, useQuotas)
- `SearchResults.tsx` (possiblement useQuotas)
- Plusieurs composants UI qui vérifient les permissions

---

## ✅ CONCLUSION

L'audit révèle un **problème majeur de duplication de requêtes** qui impacte significativement les performances. La cause principale est l'absence de gestion globale du cache et de déduplication des requêtes.

**Impact business**:
- Expérience utilisateur dégradée (temps de chargement)
- Coûts Supabase potentiellement élevés
- Risque d'atteindre les limites de rate limiting

**Prochaines étapes immédiates**:
1. ✅ Implémenter React Query (Priorité 1, tâche 1)
2. ✅ Débouncer les upserts de quotas (Priorité 1, tâche 2)
3. ✅ Fixer les erreurs Realtime (Priorité 1, tâche 3)

**ROI estimé**: 
- Temps d'implémentation: **4-5 heures**
- Amélioration performance: **60-80%**
- Réduction coûts Supabase: **70-80%**

