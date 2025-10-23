# HOTFIX - JWT Authentication Edge Functions Configuration
**Date**: 2025-10-23  
**Criticité**: 🔴 CRITIQUE (P0)  
**Impact**: Feature Benchmark complètement inaccessible  
**Temps de résolution**: ~2h de debug  

---

## 🚨 Problème

### Symptôme
```json
{
  "code": 401,
  "message": "Invalid JWT"
}
```

- **Edge Function impactée** : `generate-benchmark`
- **Fréquence** : 100% des tentatives (récurrent depuis plusieurs versions)
- **User Impact** : Impossibilité totale de générer des benchmarks

### Contexte
L'erreur 401 apparaissait **AVANT** l'exécution du code de la fonction Edge :
- ✅ Token JWT valide envoyé par le frontend
- ✅ Session utilisateur active
- ❌ Aucun log custom (`console.log`) n'apparaissait dans les logs Supabase
- ❌ Code de la fonction jamais exécuté

### Timeline
- **v1.0.3 → v1.0.7** : Multiples tentatives de fix du code JWT (échecs)
- **v1.0.8** : Ajout de logs de debug détaillés (aucun log généré → preuve que le code n'est pas exécuté)
- **v1.0.9** : Identification de la cause racine dans `config.toml`

---

## 🔍 Analyse Technique

### Cause Racine
**Configuration manquante dans `supabase/config.toml`** :

```toml
# ❌ AVANT - Configuration absente
[functions.import-csv]
verify_jwt = true

[functions.reindex-ef-all-atomic]
verify_jwt = true

# Admin functions - we manually validate JWT in code to support ES256
[functions.get-admin-workspaces]
verify_jwt = false

[functions.get-admin-contacts]
verify_jwt = false
```

**Comportement par défaut** : Supabase Edge Runtime applique `verify_jwt = true` pour toutes les fonctions non configurées.

### Pourquoi ça échouait
1. **Validation JWT automatique** : Supabase Edge Runtime tente de valider le JWT **avant** d'invoquer le code
2. **Algorithme ES256** : Le projet utilise potentiellement ES256 (elliptic curve) au lieu de HS256 (HMAC)
3. **Rejet précoce** : Si la validation échoue, le runtime retourne 401 sans jamais exécuter le code de la fonction
4. **Aucun log** : Les `console.log` personnalisés ne sont jamais atteints

### Pattern observé
Les fonctions `get-admin-workspaces` et `get-admin-contacts` fonctionnaient car elles avaient déjà `verify_jwt = false` avec validation manuelle dans le code.

La fonction `algolia-search-proxy` fonctionnait malgré l'absence de configuration car elle gère l'authentification comme **optionnelle** (pas de 401 si pas de token).

---

## ✅ Solution

### 1. Configuration `supabase/config.toml`

```toml
# Benchmark function - manual JWT validation to support ES256
[functions.generate-benchmark]
verify_jwt = false

# Algolia search proxy - no JWT verification (optional auth)
[functions.algolia-search-proxy]
verify_jwt = false
```

### 2. Validation JWT dans le code (déjà présente)

```typescript
// ✅ Pattern robuste utilisé dans generate-benchmark
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const authHeader = req.headers.get('authorization');
if (!authHeader) {
  return jsonResponse(401, { error: 'Authorization required' });
}

const token = authHeader.replace('Bearer ', '');
const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

if (authError || !user) {
  return jsonResponse(401, { 
    error: 'Invalid or expired token',
    details: authError.message 
  });
}

const userId = user.id;
```

### 3. Redéploiement
```bash
supabase functions deploy generate-benchmark
```

**Version Edge Function** : `v1.0.9`

---

## 📊 Résultats

### Avant (v1.0.8)
```
POST /functions/v1/generate-benchmark → 401 (81ms)
Logs: (aucun log custom)
```

### Après (v1.0.9)
```
POST /functions/v1/generate-benchmark → 200 (524ms)
Logs:
  [generate-benchmark] Starting authentication
  [generate-benchmark] Auth header present: true
  [generate-benchmark] Token length: 2847
  ✅ User authenticated: <user_id>
  ✅ Starting benchmark generation for workspace: <workspace_id>
```

---

## 🎓 Leçons Apprises

### ⚠️ RÈGLE CRITIQUE POUR TOUTE NOUVELLE EDGE FUNCTION

**Si votre Edge Function nécessite une authentification** :

1. **TOUJOURS ajouter dans `supabase/config.toml`** :
   ```toml
   [functions.your-function-name]
   verify_jwt = false
   ```

2. **Valider le JWT manuellement dans le code** :
   ```typescript
   const { data: { user }, error } = await supabaseClient.auth.getUser(token);
   ```

3. **Raison** : Support de l'algorithme ES256 et contrôle total de la validation

### Pattern à suivre
✅ **Inspirez-vous de** : `get-admin-workspaces`, `get-admin-contacts`, `generate-benchmark`  
❌ **N'utilisez PAS** : `verify_jwt = true` (par défaut) si vous avez des tokens ES256

### Checklist déploiement Edge Function avec Auth
- [ ] Ajout de `verify_jwt = false` dans `config.toml`
- [ ] Validation JWT manuelle dans le code
- [ ] Logs de debug pour la phase d'authentification
- [ ] Test en production après déploiement
- [ ] Vérification que les logs customs apparaissent

---

## 🔧 Fichiers Modifiés

### Configuration
- `supabase/config.toml` : Ajout config `verify_jwt = false` pour 2 fonctions

### Edge Function
- `supabase/functions/generate-benchmark/index.ts` : Logs de debug détaillés (conservés pour future debugging)

### Documentation
- `CHANGELOG.md` : Entrée hotfix avec pattern à suivre
- `HOTFIX_2025-10-23_jwt_edge_functions_config.md` : Ce document

---

## 📝 Références

### Logs Supabase analysés
- Version 25 (dernière version fonctionnelle) : `POST 200`
- Versions 26-30 (avec erreur) : `POST 401` sans aucun log custom

### Commits associés
- Configuration : `supabase/config.toml` (+9 lignes)
- Documentation : `CHANGELOG.md`, `HOTFIX_2025-10-23_jwt_edge_functions_config.md`

### Edge Functions concernées
- ✅ `generate-benchmark` : Fixée (v1.0.9)
- ℹ️ `algolia-search-proxy` : Config ajoutée par sécurité (déjà fonctionnelle)
- ℹ️ `get-admin-workspaces` : Déjà correctement configurée
- ℹ️ `get-admin-contacts` : Déjà correctement configurée

---

## 🎯 Action Items Futurs

1. **Audit** : Vérifier toutes les Edge Functions pour s'assurer qu'elles ont la bonne config
2. **Template** : Créer un template d'Edge Function avec la config correcte
3. **Documentation** : Mettre à jour le guide de développement Edge Functions
4. **Monitoring** : Ajouter une alerte si une fonction retourne 401 sans logs

---

**Résolution confirmée** : ✅ Feature Benchmark opérationnelle (testé en production)  
**Prévention future** : ✅ Pattern documenté dans CHANGELOG et ce hotfix

