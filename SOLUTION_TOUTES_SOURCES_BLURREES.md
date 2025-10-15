# Solution : Toutes les sources sont blurrées pour guillaumears44@gmail.com

**Date** : 2025-10-15  
**Utilisateur** : guillaumears44@gmail.com  
**Problème** : TOUTES les sources apparaissent blurrées, même les sources 'free'

---

## 🔍 Audit complet effectué

### ✅ Côté serveur : TOUT EST CORRECT

1. **Source CBAM** : `access_level = 'free'`, `is_global = true` ✅
2. **Utilisateur** : Existe dans `auth.users` et `public.users` ✅
3. **Workspace** : workspace_id = `de960863-892c-45e2-8288-b9bbc69bc03b` ✅
4. **RLS policies** : Policy `fe_sources_select` permet SELECT pour `authenticated` ✅
5. **Toutes les sources 'free'** : Correctement marquées dans la DB ✅

### ❌ Problème identifié : Côté frontend

Le hook `useEmissionFactorAccess` ne charge pas correctement les métadonnées des sources.

**Symptôme** : Si `sourcesMetadata` est vide, `shouldBlurPaidContent()` ne trouve pas les métadonnées et considère toutes les sources comme inconnues.

---

## 🎯 Causes possibles

### 1. **Le `currentWorkspace` est `null`**
   - Le `WorkspaceContext` attend que `userProfile.workspace_id` soit chargé
   - Si le profil tarde à charger, `currentWorkspace` reste `null`
   - Le hook vérifie : `if (!user || !currentWorkspace) return;`
   - **Résultat** : `sourcesMetadata` reste vide, toutes les sources sont blurrées

### 2. **Cache navigateur**
   - L'utilisateur s'est connecté 20 secondes après la migration (08:20:23 vs 08:20:03)
   - Anciennes données en cache avec `'standard'`/`'premium'`

### 3. **Problème de timing / Race condition**
   - `useEmissionFactorAccess` se charge avant que `WorkspaceContext` ne soit prêt
   - `currentWorkspace` passe de `null` à un objet valide, mais le hook ne re-fetch pas

---

## ✅ Solutions

### Solution 1 : Hard refresh (IMMÉDIAT)

Demander à l'utilisateur de faire un **hard refresh** :
- **Mac** : `Cmd + Shift + R`
- **Windows/Linux** : `Ctrl + Shift + R`

**Pourquoi ça marche** : Efface le cache et recharge toutes les données

---

### Solution 2 : Vider le cache + Déconnexion/Reconnexion

Si le hard refresh ne suffit pas :
1. Vider le cache du navigateur (Paramètres → Confidentialité → Effacer les données)
2. Se déconnecter de l'application
3. Se reconnecter

---

### Solution 3 : Corriger le hook `useEmissionFactorAccess` (CODE)

Le problème pourrait être que le hook ne re-fetch pas quand `currentWorkspace` change de `null` à un objet valide pendant le chargement initial.

#### Fichier : `src/hooks/useEmissionFactorAccess.ts`

**Problème actuel (ligne 64)** :
```typescript
useEffect(() => {
  fetchSources();
}, [user, currentWorkspace]);
```

Le problème : Si `currentWorkspace` passe de `null` à un objet pendant le chargement, mais que `fetchSources` retourne early à cause de `if (!user || !currentWorkspace) return;`, les métadonnées ne sont jamais chargées.

**Solution** : Ajouter une vérification et re-trigger :

```typescript
useEffect(() => {
  if (!user) {
    setSourcesMetadata(new Map());
    setFreeSources([]);
    setAssignedSources([]);
    return;
  }

  if (!currentWorkspace) {
    // Ne pas réinitialiser, attendre que le workspace soit chargé
    return;
  }

  fetchSources();
}, [user, currentWorkspace]);
```

**OU MIEUX** : Ajouter des logs pour debug :

```typescript
useEffect(() => {
  console.log('[useEmissionFactorAccess] Effect triggered', { 
    hasUser: !!user, 
    hasWorkspace: !!currentWorkspace,
    workspaceId: currentWorkspace?.id 
  });
  
  const fetchSources = async () => {
    if (!user || !currentWorkspace) {
      console.log('[useEmissionFactorAccess] Early return', { hasUser: !!user, hasWorkspace: !!currentWorkspace });
      return;
    }

    console.log('[useEmissionFactorAccess] Fetching sources for workspace:', currentWorkspace.id);

    try {
      // Récupérer toutes les sources avec leurs métadonnées (free/paid)
      const { data: allSourcesData, error: sourcesError } = await supabase
        .from('fe_sources')
        .select('source_name, access_level, is_global')
        .eq('is_global', true);

      console.log('[useEmissionFactorAccess] Sources fetched:', {
        count: allSourcesData?.length,
        error: sourcesError,
        sample: allSourcesData?.slice(0, 3)
      });

      if (allSourcesData) {
        // Créer la map des métadonnées
        const metadataMap = new Map<string, SourceMetadata>();
        const freeSourcesList: string[] = [];

        allSourcesData.forEach(source => {
          metadataMap.set(source.source_name, {
            access_level: source.access_level as 'free' | 'paid',
            is_global: source.is_global
          });

          if (source.access_level === 'free') {
            freeSourcesList.push(source.source_name);
          }
        });

        console.log('[useEmissionFactorAccess] Metadata processed:', {
          totalSources: metadataMap.size,
          freeSources: freeSourcesList.length,
          cbamAccessLevel: metadataMap.get('CBAM')?.access_level
        });

        setSourcesMetadata(metadataMap);
        setFreeSources(freeSourcesList);
      }

      // Récupérer les sources assignées au workspace
      const { data: assignedSourcesData, error: assignError } = await supabase
        .from('fe_source_workspace_assignments')
        .select('source_name')
        .eq('workspace_id', currentWorkspace.id);

      console.log('[useEmissionFactorAccess] Assigned sources:', {
        count: assignedSourcesData?.length,
        error: assignError,
        sources: assignedSourcesData?.map(s => s.source_name)
      });

      if (assignedSourcesData) {
        setAssignedSources(assignedSourcesData.map(s => s.source_name));
      }
    } catch (error) {
      console.error('[useEmissionFactorAccess] Error fetching source data:', error);
    }
  };

  fetchSources();
}, [user, currentWorkspace]);
```

---

### Solution 4 : Vérifier WorkspaceContext (CODE)

Assurer que le `WorkspaceContext` charge bien le workspace avant que les composants ne l'utilisent.

#### Fichier : `src/contexts/WorkspaceContext.tsx`

Ajouter des logs :

```typescript
const fetchWorkspace = async () => {
  console.log('[WorkspaceContext] Fetching workspace', { 
    hasUser: !!user,
    userLoading,
    profileWorkspaceId: userProfile?.workspace_id
  });

  // Attendre que le profil soit chargé
  if (!user) {
    setCurrentWorkspace(null);
    setLoading(false);
    return;
  }
  if (userLoading) {
    setLoading(true);
    return;
  }
  
  // Validation : workspace_id requis
  if (!userProfile || !userProfile.workspace_id || userProfile.workspace_id.trim() === '') {
    console.warn('[WorkspaceContext] No workspace_id in userProfile');
    setCurrentWorkspace(null);
    setLoading(false);
    return;
  }

  try {
    const { data, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', userProfile.workspace_id)
      .single();

    if (error) {
      console.error('[WorkspaceContext] Error fetching workspace:', error);
      setCurrentWorkspace(null);
    } else {
      console.log('[WorkspaceContext] Workspace loaded:', { 
        id: data.id, 
        name: data.name 
      });
      setCurrentWorkspace(data);
    }
  } catch (error) {
    console.error('[WorkspaceContext] Error in fetchWorkspace:', error);
    setCurrentWorkspace(null);
  }

  setLoading(false);
};
```

---

## 🧪 Tests de validation

### Test côté utilisateur (navigateur)

Demander à guillaumears44 d'ouvrir la console (F12) et de coller ce code :

```javascript
// Test 1 : Vérifier le workspace
console.log('=== TEST WORKSPACE ===');
console.log('Current workspace:', window.location); // Pour voir la page actuelle

// Test 2 : Vérifier localStorage/sessionStorage
console.log('=== TEST STORAGE ===');
console.log('localStorage:', {...localStorage});
console.log('sessionStorage:', {...sessionStorage});

// Test 3 : Vérifier les requêtes réseau
console.log('=== ACTION ===');
console.log('Allez dans Network Tab, filtrez "fe_sources" et rechargez la page');
console.log('Vérifiez que la réponse contient access_level: "free" pour CBAM');
```

### Test attendu

1. **Hard refresh** devrait résoudre le problème immédiatement
2. Si pas résolu, vérifier les logs dans la console
3. Si pas de requête vers `fe_sources`, c'est un problème de `currentWorkspace` null

---

## 📋 Checklist de résolution

- [ ] **Étape 1** : Demander à l'utilisateur de faire un hard refresh (Cmd+Shift+R)
- [ ] **Étape 2** : Si pas résolu, demander de vider cache + déconnexion/reconnexion
- [ ] **Étape 3** : Si toujours pas résolu, ajouter les logs de debug dans le code
- [ ] **Étape 4** : Analyser les logs dans la console navigateur
- [ ] **Étape 5** : Identifier si `currentWorkspace` est null ou si `sourcesMetadata` est vide
- [ ] **Étape 6** : Corriger le problème de timing/race condition identifié

---

## 🎯 Prochaines actions

### IMMÉDIAT (maintenant)
1. Demander à guillaumears44 de faire un **hard refresh**
2. Tester si CBAM et les autres sources free sont maintenant visibles

### SI ÇA NE FONCTIONNE PAS
1. Ajouter les logs de debug dans `useEmissionFactorAccess.ts`
2. Demander à l'utilisateur de recharger et de copier les logs de la console
3. Analyser les logs pour identifier le problème exact

### CORRECTION CODE (si nécessaire)
1. Améliorer le hook pour mieux gérer le cas `currentWorkspace = null`
2. Ajouter un état de chargement visible pour l'utilisateur
3. Ajouter un message d'erreur si les métadonnées ne peuvent pas être chargées

---

## 📝 Conclusion

Le problème vient très probablement d'un **cache navigateur** ou d'un **problème de timing** lors du chargement initial du workspace.

**Solution la plus rapide** : Hard refresh (Cmd+Shift+R)

**Solution robuste** : Ajouter des logs et corriger le timing dans le hook si nécessaire

---

**Créé par** : Diagnostic complet  
**Date** : 2025-10-15  
**Priorité** : 🔴 Haute (utilisateur bloqué)


