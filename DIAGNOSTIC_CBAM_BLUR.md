# Diagnostic : CBAM apparaît blurré pour guillaumears44@gmail.com

**Date** : 2025-10-15  
**Utilisateur affecté** : guillaumears44@gmail.com  
**Problème** : La source CBAM apparaît blurrée alors qu'elle devrait être gratuite

---

## 🔍 Résultats de l'audit

### 1. Vérification de la source CBAM dans la base de données

```sql
SELECT source_name, access_level, is_global, updated_at
FROM fe_sources
WHERE source_name = 'CBAM';
```

**Résultat** ✅ :
- `source_name`: "CBAM" (4 caractères, pas d'espaces)
- `access_level`: **'free'** ✅
- `is_global`: **true** ✅
- `updated_at`: 2025-10-15 08:20:03

**Conclusion** : La source est correctement configurée côté serveur.

---

### 2. Vérification de l'utilisateur et workspace

```sql
-- Utilisateur
SELECT id, email, last_sign_in_at
FROM auth.users
WHERE email = 'guillaumears44@gmail.com';
```

**Résultat** ✅ :
- `id`: 1cb0d91a-31cf-4ea5-aa4b-e91ca0c0a674
- `email`: guillaumears44@gmail.com
- `last_sign_in_at`: **2025-10-15 08:20:23** (20 secondes APRÈS la mise à jour de CBAM)

```sql
-- Workspace
SELECT w.id, w.name, w.owner_id
FROM workspaces w
LEFT JOIN user_roles ur ON ur.workspace_id = w.id
WHERE w.owner_id = '1cb0d91a-31cf-4ea5-aa4b-e91ca0c0a674'
   OR ur.user_id = '1cb0d91a-31cf-4ea5-aa4b-e91ca0c0a674';
```

**Résultat** ✅ :
- `workspace_id`: de960863-892c-45e2-8288-b9bbc69bc03b
- `workspace_name`: "Global Administration"
- `role`: member (pas owner)

**Conclusion** : L'utilisateur est membre d'un workspace valide.

---

### 3. Vérification des assignations

```sql
SELECT source_name
FROM fe_source_workspace_assignments
WHERE source_name = 'CBAM';
```

**Résultat** ✅ :
- Aucune assignation (normal car CBAM est 'free')

```sql
SELECT source_name
FROM fe_source_workspace_assignments
WHERE workspace_id = 'de960863-892c-45e2-8288-b9bbc69bc03b';
```

**Résultat** ✅ :
- "Axel Import "
- "Eco-Platform" (paid)
- "Import Axel Transport Routier "
- "Ma Base Perso"

**Conclusion** : Aucune assignation incorrecte, CBAM n'est pas dans les assignations (ce qui est correct).

---

### 4. Vérification de toutes les sources globales

```sql
SELECT source_name, access_level
FROM fe_sources
WHERE is_global = true
AND source_name IN ('CBAM', 'Base Carbone v23.4', 'Agribalyse 3.2', 'Carbon Minds');
```

**Résultat** ✅ :
- CBAM: **'free'** ✅
- Base Carbone v23.4: 'free' ✅
- Agribalyse 3.2: 'free' ✅
- Carbon Minds: 'paid' ✅

**Conclusion** : Toutes les sources ont les bonnes valeurs.

---

## 🎯 Diagnostic

### Problème identifié : Cache côté frontend

**Timing critique** :
- Migration appliquée : 2025-10-15 08:20:03
- Connexion utilisateur : 2025-10-15 08:20:23 (20 secondes après)

**Hypothèse** :
L'utilisateur s'est connecté **juste après** la migration. Il est possible que :

1. **Cache navigateur** : Le navigateur a mis en cache les anciennes métadonnées
2. **Service Worker** : Un service worker pourrait servir des données en cache
3. **React Query / SWR cache** : Si l'app utilise une lib de caching

---

## ✅ Solutions proposées

### Solution 1 : Hard Refresh (côté utilisateur)
Demander à l'utilisateur de faire un **hard refresh** :
- **Mac** : `Cmd + Shift + R`
- **Windows/Linux** : `Ctrl + Shift + R`
- **Alternative** : Vider le cache du navigateur

### Solution 2 : Invalider le cache côté serveur
Modifier les headers HTTP pour forcer le revalidation :

```typescript
// Dans le composant ou API
headers: {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
}
```

### Solution 3 : Ajouter un versioning des métadonnées
Ajouter un timestamp ou version dans la requête pour forcer le refresh :

```typescript
// Dans useEmissionFactorAccess.ts
const { data: allSourcesData } = await supabase
  .from('fe_sources')
  .select('source_name, access_level, is_global')
  .eq('is_global', true)
  .gte('updated_at', '1970-01-01'); // Force query refresh
```

### Solution 4 : Vérifier React Query cache (si utilisé)
Si l'app utilise React Query, invalider le cache :

```typescript
queryClient.invalidateQueries(['sources']);
```

---

## 🔧 Action immédiate recommandée

### Pour guillaumears44@gmail.com :
1. Demander de faire un **hard refresh** (Cmd + Shift + R)
2. Si le problème persiste, **vider le cache et cookies** du navigateur
3. Si toujours un problème, se **déconnecter/reconnecter**

### Pour les développeurs :
1. Vérifier s'il y a un système de cache (React Query, SWR, etc.)
2. Ajouter un mécanisme d'invalidation de cache après les migrations
3. Considérer l'ajout d'un bouton "Rafraîchir les métadonnées" dans l'UI Admin

---

## 📊 Tests de validation

### Test 1 : Vérifier dans la console navigateur

Demander à l'utilisateur d'ouvrir la console (F12) et exécuter :

```javascript
// Vérifier ce que le hook charge
console.log('Sources Metadata:', window.__REACT_DEVTOOLS_GLOBAL_HOOK__);
```

### Test 2 : Vérifier le Network Tab

Dans l'onglet Network :
1. Rechercher la requête vers `/fe_sources`
2. Vérifier la réponse : CBAM doit avoir `access_level: 'free'`
3. Vérifier les headers de cache

### Test 3 : Test avec autre utilisateur

Demander à un autre utilisateur (axelgirard.pro+dev@gmail.com) de vérifier si CBAM est bien non-blurrée.

**Résultat attendu** : ✅ CBAM fonctionne pour axelgirard → Confirme que c'est un problème de cache local

---

## 🚀 Prochaines étapes

1. ✅ **Immédiat** : Demander à guillaumears44 de faire un hard refresh
2. ⏳ **Court terme** : Implémenter un mécanisme d'invalidation de cache post-migration
3. 📋 **Moyen terme** : Ajouter un versioning des métadonnées sources
4. 🔍 **Long terme** : Monitoring des problèmes de cache similaires

---

## 📝 Notes techniques

### Code du hook useEmissionFactorAccess

```typescript
const shouldBlurPaidContent = useCallback((source: string) => {
  const metadata = sourcesMetadata.get(source);
  if (!metadata) return false; // Source inconnue = pas de blur
  
  // Si la source est 'free', jamais de blur (accessible à tous)
  if (metadata.access_level === 'free') return false;
  
  // Si 'paid', blur uniquement si non-assignée au workspace
  return !assignedSources.includes(source);
}, [sourcesMetadata, assignedSources]);
```

**Logique** ✅ : 
- Si `metadata.access_level === 'free'` → `return false` (pas de blur)
- CBAM est 'free' → devrait retourner `false`

**Problème** : `sourcesMetadata` pourrait contenir des anciennes données en cache.

---

**Créé par** : Audit automatique  
**Date** : 2025-10-15  
**Status** : En attente de validation utilisateur (hard refresh)


