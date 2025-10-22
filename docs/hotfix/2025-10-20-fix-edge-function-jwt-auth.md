# Hotfix: Correction de l'authentification JWT dans l'Edge Function Algolia

**Date**: 2025-10-20  
**Version Edge Function**: v140 → v142  
**Statut**: ✅ Résolu et déployé

---

## 🎯 Problème identifié

Après la rotation des clés JWT Supabase, l'Edge Function `algolia-search-proxy` ne parvenait plus à authentifier les utilisateurs, ce qui empêchait l'affichage des résultats privés (filtres "Base personnelle").

### Symptômes

1. **Filtre "Base personnelle" retourne 0 résultat** malgré la présence de 117 records privés en base
2. **JWT envoyé mais non décodé** : le token était bien présent dans les headers de la requête mais `userId` restait `NULL` dans l'Edge Function
3. **Logs Edge Function montrant** :
   ```json
   {
     "userId": null,
     "workspaceId": null,
     "appliedFilters": "scope:private",
     "appliedFacetFilters": "[['workspace_id:_none_']]"
   }
   ```

### Cause racine

L'Edge Function utilisait `await supabaseAuth.auth.getUser()` **sans passer le token en paramètre**, ce qui ne fonctionnait plus après la rotation des clés JWT.

Selon la [documentation officielle Supabase](https://supabase.com/docs/guides/functions/auth), la méthode correcte est :

```typescript
const token = authHeader.replace('Bearer ', '')
const { data: { user } } = await supabaseClient.auth.getUser(token)
```

---

## ✅ Solution implémentée

### 1. Correction de l'authentification JWT (v140)

**Fichier modifié** : `supabase/functions/algolia-search-proxy/index.ts`

**Avant** :
```typescript
const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
```

**Après** :
```typescript
const token = authHeader.replace('Bearer ', '')
const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
```

### 2. Correction du filtre public (v141)

**Problème secondaire** : Une fois l'authentification corrigée, le filtre "Base commune" ne retournait plus que 268k résultats au lieu de 448k.

**Cause** : L'Edge Function appliquait des `facetFilters` sur le scope public pour les utilisateurs authentifiés :
```typescript
appliedFacetFilters = [[ 'access_level:free', `assigned_workspace_ids:${workspaceId}` ]]
```

**Solution** : Supprimer les `facetFilters` pour le scope public, le blurring des sources premium se faisant déjà dans `postProcessResults` :
```typescript
if (origin === 'public') {
  appliedFilters = `scope:public`
  appliedFacetFilters = [] // Pas de restriction supplémentaire
  attributesToRetrieve = undefined
}
```

### 3. Nettoyage du code legacy (v142)

Suppression de tous les logs de debug et commentaires obsolètes dans :
- `supabase/functions/algolia-search-proxy/index.ts`
- `src/lib/algolia/proxySearchClient.ts`

---

## 📊 Résultats après correction

| Filtre           | Avant hotfix | Après hotfix | Attendu |
|------------------|--------------|--------------|---------|
| Base personnelle | 0 résultats  | 117 résultats | ✅ 117  |
| Base commune     | 268k         | 448k résultats | ✅ 448k |

---

## 🔧 Fichiers modifiés

1. **`supabase/functions/algolia-search-proxy/index.ts`**
   - Correction de `getUser()` → `getUser(token)`
   - Suppression des `facetFilters` pour scope public
   - Nettoyage des logs de debug
   - Utilisation de `supabaseAdmin` pour contourner RLS lors de la récupération du `workspace_id`

2. **`src/lib/algolia/proxySearchClient.ts`**
   - Nettoyage des logs de debug
   - Simplification du code

---

## 🧪 Tests de validation

### Test 1 : Filtre "Base personnelle"
```bash
# Utilisateur: axelgirard.pro+dev@gmail.com
# Workspace: de960863-892c-45e2-8288-b9bbc69bc03b
# Résultat attendu: 117 records privés
```

**SQL de vérification** :
```sql
SELECT COUNT(*) 
FROM emission_factors_all_search 
WHERE scope = 'private' 
AND workspace_id = 'de960863-892c-45e2-8288-b9bbc69bc03b';
-- Résultat: 117
```

**✅ Validé** : L'application affiche bien 117 résultats avec le filtre "Base personnelle"

### Test 2 : Filtre "Base commune"
```sql
SELECT COUNT(*) 
FROM emission_factors_all_search 
WHERE scope = 'public';
-- Résultat: 447 931
```

**✅ Validé** : L'application affiche bien ~448k résultats avec le filtre "Base commune"

---

## 🔍 Points techniques importants

### 1. Authentification JWT dans les Edge Functions

**Méthode recommandée par Supabase** :
```typescript
// ✅ CORRECT
const token = req.headers.get('Authorization')?.replace('Bearer ', '')
const { data: { user } } = await supabaseClient.auth.getUser(token)

// ❌ INCORRECT (ne fonctionne pas après rotation de clés)
const { data: { user } } = await supabaseClient.auth.getUser()
```

### 2. Bypass RLS pour les métadonnées utilisateur

Pour récupérer le `workspace_id` d'un utilisateur authentifié, il faut utiliser `supabaseAdmin` (avec `SERVICE_ROLE_KEY`) pour contourner les politiques RLS :

```typescript
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
const { data: userRow } = await supabaseAdmin
  .from('users')
  .select('workspace_id')
  .eq('user_id', userId)
  .single()
```

### 3. Architecture des filtres Algolia

| Scope    | Filtre appliqué            | Blurring                        |
|----------|----------------------------|----------------------------------|
| `public` | `filters=scope:public`     | Via `postProcessResults` (serveur) |
| `private`| `filters=scope:private` + `facetFilters=workspace_id:xxx` | Aucun (données du workspace) |

---

## 📚 Références

- [Supabase Edge Functions - Auth Integration](https://supabase.com/docs/guides/functions/auth)
- [Supabase JWT Claims Reference](https://supabase.com/docs/guides/auth/jwt-fields)
- [Algolia Search API - Filters](https://www.algolia.com/doc/api-reference/api-parameters/filters/)

---

## 🚀 Déploiement

```bash
npx supabase functions deploy algolia-search-proxy --no-verify-jwt
```

**Versions déployées** :
- v140 : Correction JWT `getUser(token)`
- v141 : Correction filtres public
- v142 : Nettoyage code legacy

---

## ✅ Checklist de validation

- [x] Filtre "Base personnelle" affiche 117 résultats
- [x] Filtre "Base commune" affiche ~448k résultats
- [x] JWT correctement décodé dans l'Edge Function
- [x] `workspace_id` correctement récupéré via `supabaseAdmin`
- [x] Logs de debug supprimés
- [x] Code legacy nettoyé
- [x] Edge Function déployée en production


