# Diagnostic Final : Filtre Private retourne 0 résultats

**Date :** 2025-10-20  
**Statut :** 🔍 Diagnostic complet effectué  
**Version Edge Function :** v133 (algolia-search-proxy)

---

## 🎯 Conclusion du diagnostic

### Données PostgreSQL : ✅ PARFAIT
- **117 records** `scope='private'` dans `emission_factors_all_search`
- **Tous** ont `workspace_id = de960863-892c-45e2-8288-b9bbc69bc03b`
- **Tous** ont `ID_FE` non-null (correction appliquée)
- **RLS policies** correctes
- **User en base** : `workspace_id` correctement assigné

### API Algolia directe : ✅ PARFAIT
- **Scénario 3** (avec `workspace_id`) → **117 hits**
- Les deux syntaxes fonctionnent (`filters` + `facetFilters`)
- Requête : `filters: "scope:private" + facetFilters: [["workspace_id:de960863..."]]`

### Edge Function : ❌ PROBLÈME IDENTIFIÉ

**L'Edge Function retourne 0 hits** parce qu'elle est en **Scénario 1 ou 2** :
- **Scénario 1** : `userId = null` (pas d'authentification)
- **Scénario 2** : `userId != null` MAIS `workspaceId = null` (échec de récupération)

---

## 🔍 Cause racine

L'Edge Function (lignes 162-171) récupère le `workspace_id` ainsi :

```typescript
if (userId) {
  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('workspace_id')
    .eq('user_id', userId)
    .single()
  
  console.log('[DEBUG] User lookup:', { userId, hasData: !!userRow, error: userError?.message, workspace_id: userRow?.workspace_id })
  
  workspaceId = userRow?.workspace_id ?? null
}
```

**Problème possible :**

1. **Le token JWT n'est pas valide** → `userId = null`
2. **Le token JWT est valide** MAIS `supabase.auth.getUser()` échoue
3. **L'utilisateur est authentifié** MAIS la requête vers `users` table échoue (RLS ?)
4. **Le `workspace_id` est bien récupéré** MAIS converti en `null` quelque part

---

## 🧪 Tests effectués

### Test 1 : Algolia direct
```bash
node test-algolia-direct.js
```
**Résultat :** ✅ **117 hits** avec `filters + facetFilters`

### Test 2 : Edge Function sans auth
```bash
node test-with-service-role.js
```
**Résultat :** ❌ **0 hits** (normal, pas d'auth)

### Test 3 : Edge Function avec mock JWT
```bash
node test-with-service-role.js
```
**Résultat :** ❌ **0 hits** (token invalide → pas de `userId`)

### Test 4 : Simulation Edge Function logic
```bash
node test-algolia-with-edge-function-filters.js
```
**Résultat :**
- Scénario 1 (no auth) → 0 hits ✅
- Scénario 2 (auth sans workspace) → 0 hits ✅
- Scénario 3 (auth avec workspace) → **117 hits** ✅

---

## ✅ Solution

### Étape 1 : Vérifier l'authentification dans l'app

**Dans la console navigateur (F12) :**

```javascript
// 1. Vérifier le token stocké
const authData = localStorage.getItem('sb-wrodvaatdujbpfpvrzge-auth-token');
console.log('Auth data:', JSON.parse(authData));

// 2. Vérifier l'expiration
const token = JSON.parse(authData);
console.log('Expires at:', new Date(token.expires_at * 1000));
console.log('Is expired?', Date.now() > token.expires_at * 1000);

// 3. Vérifier le user_id
console.log('User ID:', token.user?.id);
```

### Étape 2 : Tester avec un vrai token

Exécutez ces commandes pour tester avec authentification réelle :

```bash
# 1. Générer un token valide
TEST_PASSWORD="votre_mot_de_passe" node generate-test-token.js

# 2. Tester l'Edge Function
node test-edge-function-complete.js
```

### Étape 3 : Vérifier les RLS policies sur `users`

```sql
-- Vérifier que l'utilisateur peut accéder à sa propre ligne
SELECT 
  u.user_id,
  u.workspace_id,
  auth.uid() as current_user_id,
  u.user_id = auth.uid() as can_access
FROM users u
WHERE u.email = 'axelgirard.pro+dev@gmail.com';
```

### Étape 4 : Ajouter plus de logs de debug (déjà fait en v133)

La version 133 contient ces logs :

```typescript
console.log('[DEBUG] User lookup:', { userId, hasData: !!userRow, error: userError?.message, workspace_id: userRow?.workspace_id })
console.log('[DEBUG] Private search:', { userId, workspaceId, appliedFilters, appliedFacetFilters })
```

**Consultez les logs via :**
```bash
npx supabase functions logs algolia-search-proxy --limit 100 | grep DEBUG
```

---

## 🎯 Prochaines étapes

### Pour l'utilisateur (vous)

1. **Connectez-vous à l'app** avec `axelgirard.pro+dev@gmail.com`
2. **Ouvrez la console navigateur** (F12)
3. **Cliquez sur "Base personnelle"** (Private)
4. **Regardez les requêtes réseau** (onglet Network)
5. **Copiez le header `Authorization`** de la requête à `algolia-search-proxy`
6. **Envoyez-moi ce token** pour que je puisse tester avec

### Pour moi (diagnostic)

Une fois que j'aurai un token JWT valide, je pourrai :

1. Tester directement l'Edge Function
2. Voir les logs DEBUG
3. Identifier si `userId` ou `workspaceId` est `null`
4. Corriger le problème exact

---

## 📊 Récapitulatif

| Composant | État | Hits attendus | Hits réels |
|-----------|------|---------------|------------|
| Données Postgres | ✅ OK | 117 | 117 |
| Algolia direct | ✅ OK | 117 | 117 |
| Edge Function (no auth) | ✅ OK | 0 | 0 |
| Edge Function (mock auth) | ❌ FAIL | 117 | 0 |
| Edge Function (real auth) | ⏳ À tester | 117 | ? |

---

## 🔧 Scripts de test créés

1. `generate-test-token.js` - Génère un token JWT valide
2. `test-edge-function-complete.js` - Test complet Edge Function
3. `test-with-service-role.js` - Test sans/avec auth
4. `test-algolia-direct.js` - Test API Algolia directe
5. `test-algolia-with-edge-function-filters.js` - Simulation logique Edge Function

**Tous les scripts sont prêts à être exécutés.**

---

## 💡 Hypothèse la plus probable

L'app frontend n'envoie **PAS le token JWT** dans le header `Authorization` lors de l'appel à l'Edge Function, OU le token est expiré.

**Vérification rapide dans le code frontend :**

Cherchez dans `src/lib/algolia/proxySearchClient.ts` (lignes 28-36) :

```typescript
const { data: { session } } = await supabase.auth.getSession();
const headers: Record<string, string> = {};
if (session?.access_token) {
  headers['Authorization'] = `Bearer ${session.access_token}`;
}
```

**Si `session` est `null` ou `access_token` est vide, le problème est là.**

