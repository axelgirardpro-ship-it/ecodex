# Instructions pour test final du filtre Private

## 🎯 Objectif

Déterminer si le problème vient de l'authentification ou de l'Edge Function.

## 📋 Tests à effectuer dans l'app

### Test 1 : Vérifier l'authentification

1. **Connectez-vous** à l'app avec `axelgirard.pro+dev@gmail.com`
2. **Ouvrez la console navigateur** (F12 → Console)
3. **Collez et exécutez** ce code :

```javascript
// Récupérer la session Supabase
const { data: { session } } = await window.supabase.auth.getSession();

console.log('=== SESSION INFO ===');
console.log('User ID:', session?.user?.id);
console.log('Email:', session?.user?.email);
console.log('Token present:', !!session?.access_token);
console.log('Token length:', session?.access_token?.length);
console.log('Expires at:', new Date(session?.expires_at * 1000).toLocaleString());
console.log('Is expired:', Date.now() > (session?.expires_at * 1000));

// Copier le token pour les tests
if (session?.access_token) {
  console.log('\n✅ Token JWT disponible !');
  console.log('Copiez-le ci-dessous:');
  console.log(session.access_token);
  
  // Le copier automatiquement dans le clipboard
  navigator.clipboard.writeText(session.access_token);
  console.log('✅ Token copié dans le clipboard !');
} else {
  console.error('❌ Pas de token - utilisateur non authentifié');
}
```

**Résultat attendu :**
- User ID doit être `e6e2e278-14e9-44fd-86ff-28da775f43c6`
- Token present = `true`
- Is expired = `false`

### Test 2 : Vérifier la requête réseau

1. **Restez connecté** dans l'app
2. **Ouvrez l'onglet Network** (F12 → Network)
3. **Cliquez sur "Base personnelle"** (filtre Private)
4. **Trouvez la requête** `algolia-search-proxy` dans la liste
5. **Cliquez dessus** et allez dans l'onglet **Headers**
6. **Vérifiez** :
   - Request Headers contient `Authorization: Bearer eyJ...`
   - Request Payload contient `"origin": "private"`

**Screenshot attendu :**
```
Request Headers:
  authorization: Bearer eyJhbGc...très_long_token...
  content-type: application/json

Request Payload:
  {
    "requests": [{
      "params": {
        "query": "",
        "origin": "private",
        ...
      }
    }]
  }
```

### Test 3 : Tester avec le token réel

1. **Copiez le token** depuis Test 1
2. **Dans votre terminal**, exécutez :

```bash
cd "/Users/axelgirard/Eco Search Cursor /datacarb"

# Créer le fichier .test-token.json avec le vrai token
cat > .test-token.json << 'EOF'
{
  "access_token": "COLLEZ_VOTRE_TOKEN_ICI",
  "user_id": "e6e2e278-14e9-44fd-86ff-28da775f43c6",
  "expires_at": 9999999999
}
EOF

# Exécuter le test
node test-edge-function-complete.js
```

**Résultat attendu :**
- Test 2 (Mode private AVEC authentification) → **117 hits** ✅
- Test 3 (Mode private + recherche "Axel") → **117 hits** ✅

---

## 🔍 Diagnostic selon les résultats

### Cas A : Pas de token dans Test 1
**Symptôme :** `Token present: false`

**Cause :** Utilisateur pas authentifié ou session expirée

**Solution :**
1. Se déconnecter/reconnecter
2. Vider le localStorage
3. Vérifier que le login fonctionne

### Cas B : Token présent MAIS pas dans la requête (Test 2)
**Symptôme :** Header `Authorization` absent

**Cause :** Bug frontend - le token n'est pas envoyé

**Solution :** Vérifier `proxySearchClient.ts` ligne 29-32

### Cas C : Token présent ET dans la requête MAIS 0 hits
**Symptôme :** Test 1 & 2 OK, mais Test 3 retourne 0 hits

**Cause :** L'Edge Function ne récupère pas le `workspace_id`

**Solution :** Consulter les logs Edge Function :

```bash
npx supabase functions logs algolia-search-proxy --limit 100 | grep -A 5 "DEBUG"
```

Cherchez ces lignes :
```
[DEBUG] User lookup: { userId: 'e6e2e278...', hasData: true/false, workspace_id: '...' }
[DEBUG] Private search: { userId: '...', workspaceId: '...' }
```

**Si `workspaceId: null`** → Problème de récupération depuis la table `users`

---

## 📊 Checklist de diagnostic

- [ ] Test 1 effectué - Token présent
- [ ] Test 1 effectué - Token non expiré  
- [ ] Test 2 effectué - Header Authorization présent
- [ ] Test 2 effectué - Payload contient `origin: private`
- [ ] Test 3 effectué - Retourne 117 hits OU 0 hits
- [ ] Logs Edge Function consultés
- [ ] Screenshot de la requête Network attaché

---

## 🎯 Une fois tous les tests effectués

**Envoyez-moi :**
1. Le résultat de Test 1 (console logs)
2. Screenshot de Test 2 (requête Network)
3. Le résultat de Test 3 (test-edge-function-complete.js)
4. Les logs Edge Function si disponibles

Je pourrai alors identifier le problème exact et le corriger immédiatement.


