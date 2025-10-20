# Fix Edge Function workspace_id - 2025-10-16

## Contexte

L'Edge Function `algolia-search-proxy` retournait des erreurs 500 dans certains cas de recherche privée, en raison d'une gestion insuffisante du `workspace_id`.

## Problème identifié

### Symptômes
- Erreur HTTP 500 sur certaines requêtes POST vers `/functions/v1/algolia-search-proxy`
- Temps d'exécution normal (~200-300ms) mais échec de la requête
- Erreurs intermittentes, certaines requêtes passaient, d'autres échouaient

### Cause racine

Dans le cas où `searchType === 'fullPrivate'` et `!clientHasWsFilter`, le code construisait un filtre Algolia avec un `workspace_id` potentiellement `null` ou `undefined` :

```typescript
// ❌ Code problématique (ligne 338)
appliedFilters = `scope:private AND workspace_id:\"${requestWorkspaceId}\"`
```

Si `requestWorkspaceId` était `null` ou `undefined`, cela générait un filtre invalide :
```
scope:private AND workspace_id:"undefined"
```

Cela causait soit une erreur Algolia, soit des résultats vides inattendus, et dans certains cas, une exception non capturée dans l'Edge Function.

## Solution implémentée

### 1. Validation stricte du workspace_id

Ajout d'une validation explicite avant de construire le filtre :

```typescript
// ✅ Code corrigé
case 'fullPrivate':
  if (clientHasWsFilter) {
    appliedFilters = `scope:private`
  } else {
    // Validation stricte : requestWorkspaceId doit être valide pour fullPrivate
    if (!requestWorkspaceId || !isUuid(requestWorkspaceId)) {
      throw new Error('INVALID_WORKSPACE_ID')
    }
    // Échappement sûr du workspace_id pour Algolia
    const wsIdSafe = String(requestWorkspaceId).replace(/"/g, '\\"')
    appliedFilters = `scope:private AND workspace_id:"${wsIdSafe}"`
  }
  break
```

### 2. Meilleure gestion des erreurs

Ajout de logs détaillés et de messages d'erreur spécifiques :

```typescript
catch (error) { 
  const origin = req.headers.get('Origin'); 
  const msg = String((error as any)?.message || error);
  
  // Log détaillé de l'erreur pour diagnostic
  console.error('Edge Function Error:', {
    message: msg,
    stack: (error as any)?.stack,
    type: (error as any)?.name
  });
  
  // Gestion des erreurs spécifiques
  if (msg.includes('MISSING_WORKSPACE_ID')) {
    return jsonResponse(400, { error: 'workspace_id requis pour la recherche privée' }, origin)
  }
  
  if (msg.includes('INVALID_WORKSPACE_ID')) {
    return jsonResponse(400, { error: 'workspace_id invalide pour la recherche privée' }, origin)
  }
  
  // Erreur générique avec détails pour diagnostic
  return jsonResponse(500, { 
    error: 'Internal server error', 
    details: msg,
    timestamp: new Date().toISOString()
  }, origin) 
}
```

## Bénéfices

1. **Validation stricte** : Le workspace_id est maintenant validé avant utilisation
2. **Messages d'erreur clairs** : Les utilisateurs et développeurs reçoivent des messages explicites
3. **Échappement sécurisé** : Protection contre les injections dans les filtres Algolia
4. **Meilleur diagnostic** : Logs détaillés pour faciliter le debugging futur
5. **Codes HTTP appropriés** : 400 pour les erreurs client, 500 pour les erreurs serveur

## Déploiement

```bash
npx supabase functions deploy algolia-search-proxy
```

Déployé le : 2025-10-16  
Version : 109 (après deployment)

## Tests à effectuer

1. ✅ Recherche publique (origin: 'public')
2. ✅ Recherche privée avec workspace valide (origin: 'private')
3. ✅ Recherche privée sans workspace (devrait retourner 400)
4. ✅ Recherche privée avec workspace invalide (devrait retourner 400)

## Monitoring

Surveiller les logs Edge Function pour :
- Réduction des erreurs 500
- Apparition d'erreurs 400 avec message "workspace_id invalide" (indique un problème côté client à corriger)
- Logs "Edge Function Error" avec détails des exceptions

## Prochaines étapes

1. Monitorer les logs pendant 24-48h
2. Si aucune erreur 500 n'apparaît, considérer le fix comme réussi
3. Retirer les logs de debug temporaires si nécessaire
4. Documenter les patterns d'utilisation correcte pour les développeurs frontend

