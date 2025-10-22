# JWT Authentication dans les Edge Functions Supabase

**Date**: 22 octobre 2025  
**Contexte**: Feature Benchmark - Erreur d'authentification 401  
**Statut**: ✅ Résolu

---

## 🔴 Problème Rencontré

### Symptômes

Lors de l'appel à l'Edge Function `generate-benchmark` depuis le frontend :

```
Error: Failed to generate benchmark
Status: 401 Unauthorized
Response: "Authorization failed: No user found"
```

### Contexte

- **Frontend** : Envoie `Authorization: Bearer <JWT>` dans les headers
- **Edge Function** : Tentative d'authentification avec `supabaseAuth.auth.getUser(token)`
- **Déploiement initial** : `supabase functions deploy generate-benchmark --project-ref wrodvaatdujbpfpvrzge`

---

## 🔍 Analyse de la Cause

### Configuration par Défaut de Supabase

Lorsqu'une Edge Function est déployée **sans flag spécifique**, Supabase applique `verify_jwt: true` par défaut. Cela signifie :

1. **Vérification automatique du JWT** : Supabase vérifie le JWT avant que le code de la fonction ne s'exécute
2. **Injection du header `x-sb-user`** : Si le JWT est valide, Supabase ajoute un header `x-sb-user` contenant les infos utilisateur (JSON)
3. **Pas d'accès au token brut** : Le header `Authorization` est consommé par Supabase, la fonction ne peut pas le récupérer

### Problème avec Notre Code

Notre code tentait d'authentifier manuellement :

```typescript
// ❌ Code problématique
const authHeader = req.headers.get('authorization');
if (!authHeader) {
  return jsonResponse(401, { error: 'Authorization failed: No header' });
}

const token = authHeader.replace('Bearer ', '');
const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
```

**Résultat** : `authHeader` était `null` car Supabase avait déjà consommé le header lors de la vérification automatique.

### Deux Approches Possibles

#### Approche 1 : `verify_jwt: true` (Par défaut)

**Principe** : Supabase vérifie le JWT automatiquement.

**Code à utiliser** :
```typescript
// ✅ Avec verify_jwt: true
const userHeader = req.headers.get('x-sb-user');
if (!userHeader) {
  return jsonResponse(401, { error: 'No authenticated user' });
}

const user = JSON.parse(userHeader);
const userId = user.id;
```

**Avantages** :
- ✅ Sécurisé par défaut
- ✅ Pas besoin de gérer la vérification JWT

**Inconvénients** :
- ❌ Pas de contrôle sur le processus d'authentification
- ❌ Header `x-sb-user` peut être `null` même avec JWT valide (rare)

#### Approche 2 : `--no-verify-jwt` (Manuel)

**Principe** : La fonction gère l'authentification elle-même.

**Code à utiliser** :
```typescript
// ✅ Avec --no-verify-jwt
let userId: string | null = null;
const authHeader = req.headers.get('authorization');

if (authHeader) {
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  
  if (!authError && user) {
    userId = user.id;
  } else {
    return jsonResponse(401, { error: 'Invalid or expired token' });
  }
}

if (!userId) {
  return jsonResponse(401, { error: 'Authorization required' });
}
```

**Avantages** :
- ✅ Contrôle total sur l'authentification
- ✅ Peut gérer des cas d'usage personnalisés (ex: tokens multiples)
- ✅ Plus clair pour le debugging

**Inconvénients** :
- ❌ Plus de code à écrire
- ❌ Doit gérer manuellement la vérification

---

## ✅ Solution Adoptée

### Décision : `--no-verify-jwt`

**Raison** : Contrôle total + clarté du code.

### Déploiement

```bash
cd /Users/axelgirard/Eco\ Search\ Cursor\ /datacarb

SUPABASE_ACCESS_TOKEN="sbp_253eb1d7db171639772b220b6f85c44107ef2568" \
  supabase functions deploy generate-benchmark \
  --project-ref wrodvaatdujbpfpvrzge \
  --no-verify-jwt
```

**Output attendu** :
```
✓ Deployed Function generate-benchmark (v1.0.0)
```

### Code Final (Edge Function)

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Variables d'environnement
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Client Supabase pour authentification
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // 🔐 AUTHENTIFICATION MANUELLE avec --no-verify-jwt
    let userId: string | null = null;
    const authHeader = req.headers.get('authorization');

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
      
      if (!authError && user) {
        userId = user.id;
      } else {
        console.error('❌ Auth error:', authError?.message);
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse body
    const body = await req.json();
    const { query, filters, facetFilters, workspaceId } = body;

    // ... rest of the function logic

    return new Response(
      JSON.stringify({ success: true, userId }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### Code Frontend (Appel)

```typescript
// src/hooks/useBenchmarkGeneration.ts
const SUPABASE_URL = 'https://wrodvaatdujbpfpvrzge.supabase.co';

const generateBenchmark = async (): Promise<BenchmarkData> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('No active session');
  }

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/generate-benchmark`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`, // ✅ JWT envoyé
      },
      body: JSON.stringify({ query, filters, facetFilters, workspaceId, userId }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Failed to generate benchmark');
  }

  return response.json();
};
```

---

## 📋 Checklist de Déploiement

Avant de déployer une Edge Function avec authentification :

- [ ] **Décider de l'approche** : `verify_jwt: true` (auto) ou `--no-verify-jwt` (manuel)
- [ ] **Si `verify_jwt: true`** :
  - [ ] Utiliser `req.headers.get('x-sb-user')`
  - [ ] Parser le JSON pour obtenir `user.id`
  - [ ] Déployer sans flag : `supabase functions deploy <name>`
- [ ] **Si `--no-verify-jwt`** :
  - [ ] Utiliser `req.headers.get('authorization')`
  - [ ] Appeler `supabaseAuth.auth.getUser(token)`
  - [ ] Déployer avec flag : `supabase functions deploy <name> --no-verify-jwt`
- [ ] **Dans tous les cas** :
  - [ ] Gérer les CORS avec `Access-Control-Allow-Origin: *`
  - [ ] Répondre aux `OPTIONS` requests (preflight)
  - [ ] Retourner 401 si authentification échoue
  - [ ] Tester avec Postman ou script de test

---

## 🔧 Scripts de Test

### Test avec Token Valide

```javascript
// test-edge-function-complete.js
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://wrodvaatdujbpfpvrzge.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testBenchmark() {
  // 1. Authentifier un utilisateur
  const { data: { session }, error } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'password123',
  });

  if (error) {
    console.error('❌ Auth failed:', error.message);
    return;
  }

  console.log('✅ Authenticated:', session.user.id);

  // 2. Appeler l'Edge Function
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/generate-benchmark`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        query: 'transport',
        workspaceId: 'workspace-id',
        userId: session.user.id,
      }),
    }
  );

  const data = await response.json();
  console.log('Response:', response.status, data);
}

testBenchmark();
```

### Test sans Token (Doit échouer)

```bash
curl -X POST \
  https://wrodvaatdujbpfpvrzge.supabase.co/functions/v1/generate-benchmark \
  -H "Content-Type: application/json" \
  -d '{"query":"transport","workspaceId":"123","userId":"456"}'

# Expected: 401 Unauthorized
```

---

## 🚨 Erreurs Courantes et Solutions

### 1. "Authorization failed: No header"

**Cause** : Edge Function déployée avec `--no-verify-jwt` mais code utilise `x-sb-user`.

**Solution** : Utiliser `authorization` header et `auth.getUser()`.

### 2. "Authorization failed: No user found"

**Cause** : JWT invalide ou expiré.

**Solution** :
- Vérifier que le JWT est récent (`session.access_token`)
- Appeler `supabase.auth.refreshSession()` si nécessaire
- Vérifier que l'utilisateur existe dans `auth.users`

### 3. "x-sb-user is null"

**Cause** : Edge Function déployée sans `--no-verify-jwt` mais code utilise `authorization` header.

**Solution** : Redéployer avec `--no-verify-jwt` ou changer le code pour utiliser `x-sb-user`.

### 4. CORS Error

**Cause** : Headers CORS manquants ou incorrects.

**Solution** :
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Preflight
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}

// Toutes les réponses
return new Response(JSON.stringify(data), { 
  headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
});
```

**Note** : Ne PAS utiliser `Access-Control-Allow-Credentials: true` avec `Origin: *`.

---

## 📚 Ressources

### Documentation Supabase

- [Edge Functions Auth](https://supabase.com/docs/guides/functions/auth)
- [JWT Verification](https://supabase.com/docs/guides/functions/deploy)
- [CORS Configuration](https://supabase.com/docs/guides/functions/cors)

### Documentation Deno

- [Deno.serve API](https://deno.land/api@v1.40.0?s=Deno.serve)
- [Headers API](https://developer.mozilla.org/en-US/docs/Web/API/Headers)

### Fichiers du Projet

- Edge Function : `supabase/functions/generate-benchmark/index.ts`
- Hook Frontend : `src/hooks/useBenchmarkGeneration.ts`
- Test Script : `test-edge-function-complete.js`

---

## ✅ Résumé pour Agents IA

### Règle d'Or

**Toujours aligner le code et le déploiement** :

| Déploiement | Code à utiliser | Header disponible |
|-------------|-----------------|-------------------|
| Par défaut (ou `verify_jwt: true`) | `req.headers.get('x-sb-user')` | `x-sb-user` |
| `--no-verify-jwt` | `req.headers.get('authorization')` + `auth.getUser()` | `authorization` |

### Checklist de Modification

Avant de modifier une Edge Function existante avec authentification :

1. **Vérifier le déploiement actuel** :
   ```bash
   supabase functions list --project-ref wrodvaatdujbpfpvrzge
   ```

2. **Vérifier le code** :
   - Si `x-sb-user` → Déployé par défaut
   - Si `authorization` + `auth.getUser()` → Déployé avec `--no-verify-jwt`

3. **Si incohérent** :
   - Soit changer le code
   - Soit redéployer avec le bon flag

4. **Tester** :
   - Avec token valide → 200 OK
   - Sans token → 401 Unauthorized
   - Token expiré → 401 Unauthorized

### Pattern Recommandé (2025)

Pour les nouvelles Edge Functions, **préférer `--no-verify-jwt`** car :
- ✅ Plus clair et prévisible
- ✅ Contrôle total sur l'authentification
- ✅ Facilite le debugging
- ✅ Pas de surprise avec `x-sb-user` null

**Code template** :
```typescript
let userId: string | null = null;
const authHeader = req.headers.get('authorization');

if (authHeader) {
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
  if (!error && user) userId = user.id;
}

if (!userId) {
  return jsonResponse(401, { error: 'Authorization required' });
}
```

**Déploiement template** :
```bash
SUPABASE_ACCESS_TOKEN="<token>" \
  supabase functions deploy <function-name> \
  --project-ref <project-ref> \
  --no-verify-jwt
```

---

**Dernière mise à jour** : 22 octobre 2025  
**Auteur** : Développement avec Claude Sonnet 4.5  
**Status** : ✅ Résolu et documenté

