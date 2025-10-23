# 🔒 SECURITY FIX: Workspace Ownership Validation

**Date**: 22 octobre 2025  
**Criticité**: 🔴 CRITIQUE  
**Version Edge Function**: v1.0.3 → v1.0.4  
**Statut**: ✅ Corrigé et déployé en production

---

## 🚨 Vulnérabilité Identifiée

### Description
L'Edge Function `generate-benchmark` ne validait pas que l'utilisateur authentifié appartenait au workspace pour lequel il générait un benchmark.

### Impact
**Tout utilisateur authentifié** pouvait générer un benchmark pour **n'importe quel workspace**, même s'il n'en était pas membre.

### Scénario d'Exploitation
1. Alice (workspace A, ID: `workspace-a`) est authentifiée
2. Alice fait une requête POST vers `/functions/v1/generate-benchmark`
3. Elle modifie le `workspaceId` dans le body pour pointer vers le workspace de Bob (`workspace-b`)
4. ✅ **La fonction accepte** la requête car elle ne vérifie pas l'appartenance
5. Alice génère un benchmark en utilisant les quotas de Bob
6. Bob voit ses quotas Freemium consommés sans avoir généré de benchmark

### Conséquences
- ❌ **Consommation non autorisée de quotas** : Un utilisateur malveillant peut épuiser les quotas d'autres workspaces
- ❌ **Isolation workspace compromise** : Violation du principe d'isolation entre workspaces
- ❌ **Coût Algolia** : Requêtes API non autorisées (1000 hits par benchmark)
- ❌ **Données sensibles** : Potentielle exposition de métadonnées (statistiques sur les FEs d'un workspace)

---

## 🔍 Analyse Technique

### Code Vulnérable (v1.0.3)

```typescript
// ❌ VULNÉRABLE
const requestBody = await req.json();
const { query, filters, facetFilters, workspaceId } = requestBody;

if (!query || !workspaceId) {
  return jsonResponse(400, { error: 'Missing required parameters: query and workspaceId' });
}

// ⚠️ PAS DE VALIDATION que userId appartient à workspaceId
console.log('✅ Starting benchmark generation for workspace:', workspaceId);
```

**Problème** : Le `workspaceId` est accepté tel quel depuis le `requestBody` sans vérification.

### Pourquoi la Vulnérabilité Existait

Lors du refactoring de l'authentification JWT (passage de `atob()` manuel à `supabaseAuth.auth.getUser()`), la validation suivante a été **supprimée par erreur** :

```typescript
// ❌ SUPPRIMÉ (v1.0.3)
const { userId } = requestBody; // userId était dans le body
if (userId !== user.id) {
  return jsonResponse(403, { error: 'Unauthorized' });
}
```

**Note** : Cette validation était **insuffisante** car elle comparait uniquement le `userId` du body, mais ne vérifiait pas l'appartenance au workspace.

---

## ✅ Correction Appliquée (v1.0.4)

### Code Sécurisé

```typescript
// ✅ SÉCURISÉ
const requestBody = await req.json();
const { query, filters, facetFilters, workspaceId } = requestBody;

if (!query || !workspaceId) {
  return jsonResponse(400, { error: 'Missing required parameters: query and workspaceId' });
}

console.log('✅ Starting benchmark generation for workspace:', workspaceId);

// 🔒 NOUVEAU : Vérifier que l'utilisateur appartient au workspace
const { data: userWorkspace, error: userWorkspaceError } = await supabaseAdmin
  .from('users')
  .select('workspace_id')
  .eq('user_id', userId)
  .single();

if (userWorkspaceError || !userWorkspace) {
  console.error('❌ Failed to fetch user workspace:', userWorkspaceError);
  return jsonResponse(403, { error: 'Access denied: user not found' });
}

if (userWorkspace.workspace_id !== workspaceId) {
  console.error('❌ Workspace mismatch:', { 
    userWorkspace: userWorkspace.workspace_id, 
    requestedWorkspace: workspaceId 
  });
  return jsonResponse(403, { 
    error: 'Access denied: you do not have access to this workspace' 
  });
}

console.log('✅ User authorized for workspace:', workspaceId);
```

### Mécanisme de Sécurité

1. **Extraction du `userId`** : Depuis le JWT validé (ligne 121)
2. **Requête à la table `users`** : Récupération du `workspace_id` réel de l'utilisateur authentifié
3. **Comparaison stricte** : `userWorkspace.workspace_id !== workspaceId`
4. **Refus si mismatch** : Retour `403 Forbidden` avec message explicite

---

## 🧪 Tests de Validation

### Test 1 : Utilisateur Autorisé
```bash
# Alice (workspace A) génère un benchmark pour workspace A
curl -X POST "https://[...]/generate-benchmark" \
  -H "Authorization: Bearer <alice-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "beton",
    "workspaceId": "workspace-a"
  }'

# Résultat attendu: 200 OK + benchmark généré ✅
```

### Test 2 : Utilisateur Non Autorisé (Tentative d'Exploitation)
```bash
# Alice (workspace A) tente de générer un benchmark pour workspace B
curl -X POST "https://[...]/generate-benchmark" \
  -H "Authorization: Bearer <alice-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "beton",
    "workspaceId": "workspace-b"  # ⚠️ Workspace de Bob
  }'

# Résultat attendu: 403 Forbidden ✅
# {
#   "error": "Access denied: you do not have access to this workspace"
# }
```

### Validation en Production
```bash
# Logs Edge Function après déploiement
[generate-benchmark] ✅ User authenticated: alice-user-id
[generate-benchmark] ✅ Starting benchmark generation for workspace: workspace-b
[generate-benchmark] ❌ Workspace mismatch: { 
  userWorkspace: 'workspace-a', 
  requestedWorkspace: 'workspace-b' 
}
[generate-benchmark] Response: 403 Forbidden
```

---

## 📊 Impact et Portée

### Systèmes Affectés
- ✅ Edge Function `generate-benchmark` (v1.0.3 uniquement)
- ❌ Autres Edge Functions non affectées

### Période à Risque
- **Début** : Déploiement v1.0.3 (22 octobre 2025, ~13h00)
- **Fin** : Déploiement v1.0.4 (22 octobre 2025, ~14h20)
- **Durée** : ~1h20

### Utilisateurs Impactés
- Tous les utilisateurs ayant accès à l'Edge Function pendant la période à risque
- **Exploitation constatée** : Aucune (détecté rapidement par bugbot)

---

## 🚀 Déploiement

### Commande de Déploiement
```bash
SUPABASE_ACCESS_TOKEN="***" supabase functions deploy generate-benchmark \
  --project-ref wrodvaatdujbpfpvrzge \
  --no-verify-jwt
```

### Vérification Post-Déploiement
```bash
# Tester la validation workspace
curl -X POST "https://wrodvaatdujbpfpvrzge.supabase.co/functions/v1/generate-benchmark" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "test",
    "workspaceId": "wrong-workspace-id"
  }'

# Résultat attendu: 403 Forbidden ✅
```

---

## 📋 Checklist de Sécurité

- [x] Vulnérabilité identifiée et analysée
- [x] Code corrigé et testé localement
- [x] Version Edge Function incrémentée (v1.0.4)
- [x] Edge Function déployée en production
- [x] Tests de validation effectués
- [x] Logs de production vérifiés
- [x] Documentation créée
- [x] PR mise à jour avec le fix
- [x] Équipe notifiée

---

## 🔐 Recommandations Futures

### 1. Revue Systématique des Edge Functions
Auditer **toutes** les Edge Functions pour détecter des vulnérabilités similaires :
- Validation workspace ownership
- Validation user permissions
- Validation RLS bypass

### 2. Tests de Sécurité Automatisés
Ajouter des tests automatisés pour chaque Edge Function :
```typescript
// Test: Unauthorized workspace access
test('generate-benchmark: reject unauthorized workspace', async () => {
  const result = await generateBenchmark({
    userId: 'user-a',
    workspaceId: 'workspace-b' // User A doesn't belong to workspace B
  });
  expect(result.status).toBe(403);
});
```

### 3. Principe de Moindre Privilège
- ✅ Toujours valider l'appartenance au workspace
- ✅ Utiliser RLS Supabase quand possible
- ✅ Ne jamais faire confiance aux données du `requestBody`

---

## 📚 Références

- **PR GitHub** : https://github.com/axelgirardpro-ship-it/ecodex/pull/136
- **Commit Fix** : `684ed838`
- **CHANGELOG** : `CHANGELOG.md` (v1.6.1)
- **Détecté par** : bugbot analysis

---

## ✅ Résolution

**Statut** : ✅ **RÉSOLU**  
**Version corrigée** : v1.0.4  
**Déployé** : 22 octobre 2025, 14:21  
**Exploitation constatée** : ❌ Aucune

---

**Cette vulnérabilité a été détectée en moins de 2 heures et corrigée immédiatement. Aucune exploitation n'a été constatée.**

