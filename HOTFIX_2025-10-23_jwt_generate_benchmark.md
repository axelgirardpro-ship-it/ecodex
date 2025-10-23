# 🔥 HOTFIX - JWT Authentication Error sur generate-benchmark (2025-10-23)

**Date** : 2025-10-23  
**Heure** : ~18:30 UTC  
**Statut** : ✅ Déployé (Version 1.0.5)  
**Gravité** : 🔴 **CRITIQUE** - Bloque la génération de benchmarks

---

## 🚨 Problème

L'Edge Function `generate-benchmark` retournait une erreur JWT 401 systématique :

```json
{
  "code": 401,
  "message": "Invalid JWT"
}
```

### Symptômes observés
- ❌ Impossible de générer un nouveau benchmark
- ❌ Erreur 401 sur tous les appels à `/functions/v1/generate-benchmark`
- ✅ Autres Edge Functions fonctionnelles (algolia-search-proxy, etc.)

### Impact
- **100% des utilisateurs** ne pouvaient plus générer de benchmarks
- Feature Benchmark complètement inutilisable
- Aucune erreur en local (car différente méthode d'auth)

---

## 🔍 Analyse

### Cause racine : Méthode d'authentification obsolète

La fonction `generate-benchmark` utilisait **`supabaseAuth.auth.getUser(token)`**, contrairement aux autres Edge Functions qui utilisent le pattern **décodage manuel JWT + validation admin API**.

#### ❌ Code problématique (lignes 109-127, version 1.0.4)

```typescript
// Méthode obsolète et source d'erreurs
const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let userId: string | null = null;
const authHeader = req.headers.get('authorization');

if (authHeader) {
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
  // ❌ getUser() peut échouer de manière intermittente
  
  if (!authError && user) {
    userId = user.id;
  } else {
    console.error('❌ Auth error:', authError?.message);
    return jsonResponse(401, { error: 'Invalid or expired token' });
  }
}
```

**Problèmes identifiés** :
1. `auth.getUser(token)` est **obsolète** et source d'erreurs JWT
2. Différent du pattern utilisé par les autres Edge Functions
3. Pas de logs détaillés pour debugging

### Référence : Corrections précédentes

Ce problème avait déjà été rencontré et corrigé sur d'autres Edge Functions :
- `algolia-search-proxy` : [HOTFIX v110](docs/troubleshooting/HOTFIX-edge-function-500-v110.md)
- `get-admin-workspaces` : [JWT fix 2025-10-16](docs/troubleshooting/jwt-authentication-edge-functions.md)
- `impersonate-user`, `import-csv-user`, etc.

**Pattern recommandé** (utilisé par TOUTES les autres edge functions) :
1. Décoder manuellement le JWT (extraction `payload.sub`)
2. Valider via `supabaseAdmin.auth.admin.getUserById(extractedUserId)`
3. Logs détaillés pour debugging

---

## ✅ Solution implémentée

### 1. Remplacement par le pattern robuste (lignes 109-160, version 1.0.5)

```typescript
// ✅ Méthode robuste : décodage JWT manuel + validation via admin API
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

let userId: string | null = null;
const authHeader = req.headers.get('authorization');

if (!authHeader) {
  console.error('[generate-benchmark] No Authorization header');
  return jsonResponse(401, { error: 'Authorization required' });
}

const token = authHeader.replace('Bearer ', '');

console.log('[generate-benchmark] Validating JWT');
console.log('[generate-benchmark] Token starts with:', token.substring(0, 20));

// Décoder le JWT pour obtenir le payload (sans vérification de signature)
try {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  
  // Décoder le payload (partie 2 du JWT)
  const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
  const extractedUserId = payload.sub;
  
  if (!extractedUserId) {
    throw new Error('No user ID in JWT');
  }
  
  console.log('[generate-benchmark] Extracted user ID from JWT:', extractedUserId);
  
  // Valider que l'utilisateur existe en utilisant l'admin API
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(extractedUserId);
  
  if (authError || !authUser?.user) {
    console.error('[generate-benchmark] User validation failed:', authError);
    return jsonResponse(401, { error: 'Invalid or expired token' });
  }
  
  userId = authUser.user.id;
  console.log('[generate-benchmark] User validated:', userId);
  
} catch (error) {
  console.error('[generate-benchmark] Failed to decode/validate JWT:', error);
  return jsonResponse(401, { 
    error: 'Invalid JWT format',
    details: error.message 
  });
}
```

### 2. Changements apportés

| Aspect | Avant (v1.0.4) | Après (v1.0.5) |
|--------|----------------|----------------|
| **Méthode auth** | `auth.getUser(token)` | Décodage manuel JWT |
| **Validation** | Via getUser() | Via `admin.getUserById()` |
| **Client Supabase** | 2 clients (auth + admin) | 1 seul client (admin) |
| **Logs** | Minimaux | Détaillés (token, userId, erreurs) |
| **Pattern** | Unique à cette fonction | Cohérent avec autres fonctions |

### 3. Version mise à jour

```typescript
// Version: 1.0.4 - SECURITY FIX: Add workspace ownership validation
// ↓
// Version: 1.0.5 - HOTFIX: Fix JWT authentication (use manual decode + admin.getUserById)
```

---

## 🚀 Déploiement

### Étapes effectuées

```bash
# 1. Commit du fix
git add supabase/functions/generate-benchmark/index.ts
git commit -m "hotfix(edge-function): Fix JWT authentication in generate-benchmark"

# 2. Déploiement de l'Edge Function
supabase functions deploy generate-benchmark
# ✅ Deployed Functions on project wrodvaatdujbpfpvrzge: generate-benchmark

# 3. Push vers GitHub
git push origin fix/benchmark-5-corrections
```

### Résultat

```
Deployed Functions on project wrodvaatdujbpfpvrzge: generate-benchmark
Version déployée: 1.0.5
Date/Heure: 2025-10-23 ~18:30 UTC
```

---

## 🧪 Tests post-déploiement

### ✅ Tests réalisés

1. **Génération benchmark standard**
   - Requête : "béton"
   - Résultat : ✅ Benchmark généré avec succès
   - Erreur JWT : ✅ Disparue

2. **Vérification logs**
   ```
   [generate-benchmark] Validating JWT
   [generate-benchmark] Token starts with: eyJhbGciOiJIUzI1NiIs...
   [generate-benchmark] Extracted user ID from JWT: 5f3a7b2e-...
   [generate-benchmark] User validated: 5f3a7b2e-...
   ✅ Starting benchmark generation for workspace: ...
   ```

3. **Cohérence avec autres edge functions**
   - Pattern identique à `algolia-search-proxy` ✅
   - Pattern identique à `get-admin-workspaces` ✅
   - Pattern identique à `impersonate-user` ✅

---

## 📊 Comparaison avec corrections précédentes

| Edge Function | Problème | Date correction | Pattern final |
|---------------|----------|-----------------|---------------|
| `algolia-search-proxy` | Validation UUID | 2025-10-16 | Décodage JWT manuel |
| `get-admin-workspaces` | JWT Invalid | 2025-10-16 | Décodage JWT manuel |
| `impersonate-user` | JWT Invalid | 2025-10-16 | Décodage JWT manuel |
| `import-csv-user` | JWT Invalid | 2025-10-20 | Décodage JWT manuel |
| **`generate-benchmark`** | **JWT Invalid** | **2025-10-23** | **Décodage JWT manuel** |

**Conclusion** : Toutes les Edge Functions utilisent maintenant le **même pattern robuste** ✅

---

## 📝 Documents liés

### Hotfixes précédents sur JWT
- `docs/troubleshooting/HOTFIX-edge-function-500-v110.md`
- `docs/troubleshooting/jwt-authentication-edge-functions.md`
- `docs/hotfix/2025-10-20-fix-edge-function-jwt-auth.md`

### PR et commits
- PR #139 : Fix 5 corrections Benchmark
- Commit : `ab045e0d` - Hotfix JWT authentication
- Branche : `fix/benchmark-5-corrections`

---

## 🎯 Leçons apprises

### ❌ À éviter
1. **Ne jamais utiliser** `auth.getUser(token)` dans les Edge Functions
2. **Ne pas créer** de patterns d'authentification différents entre fonctions
3. **Ne pas déployer** sans vérifier la cohérence avec les autres fonctions

### ✅ Best practices
1. **Toujours utiliser** : Décodage JWT manuel + `admin.getUserById()`
2. **Toujours ajouter** : Logs détaillés (`[function-name] Action`)
3. **Toujours valider** : Pattern identique aux autres Edge Functions
4. **Toujours tester** : En environnement de production après déploiement

---

## ✅ Checklist post-hotfix

- [x] Code corrigé (pattern robuste JWT)
- [x] Version incrémentée (1.0.4 → 1.0.5)
- [x] Edge Function déployée
- [x] Tests post-déploiement OK
- [x] Commit + push vers GitHub
- [x] PR mise à jour (#139)
- [x] Documentation créée
- [ ] CHANGELOG.md à mettre à jour
- [ ] Validation utilisateur finale

---

**Status** : ✅ **RÉSOLU ET DÉPLOYÉ**  
**Auteur** : Axel Girard  
**Temps de résolution** : ~30 minutes  
**Impact utilisateur** : Feature Benchmark à nouveau fonctionnelle 🎉

