# Analyse de l'erreur 500 sur algolia-search-proxy

## Contexte
L'Edge Function `algolia-search-proxy` retourne une erreur 500 (Internal Server Error) dans certains cas.

## Logs d'erreur
```json
{
  "event_message": "POST | 500 | https://wrodvaatdujbpfpvrzge.supabase.co/functions/v1/algolia-search-proxy",
  "status_code": 500,
  "execution_time_ms": 228
}
```

## Problèmes identifiés

### 1. Gestion du workspace_id dans la Edge Function

#### Ligne ~265 (buildApplied)
```typescript
const buildAppliedFor = (stype)=>{
  // ...
  case 'fullPrivate':
    // Si le client a déjà mis workspace_id dans filters, on force juste scope:private sans ajouter _none_
    if (clientHasWsFilter) {
      appliedFilters = `scope:private`;
    } else {
      appliedFilters = `scope:private AND workspace_id:\\"${requestWorkspaceId}\\"`;
    }
    break;
}
```

**Problème** : Si `requestWorkspaceId` est `undefined` ou `null`, la chaîne de filtre devient :
```
scope:private AND workspace_id:"undefined"
```

Cela peut causer des erreurs Algolia ou des résultats vides.

### 2. Échappement incorrect dans les filtres

La fonction utilise `\\"` pour échapper les guillemets, mais dans certains contextes JavaScript, cela peut créer des problèmes d'échappement.

### 3. Validation insuffisante du workspace_id

Bien que le code vérifie si un UUID valide est fourni, il ne gère pas tous les cas edge :
- Workspace_id présent mais invalide
- Workspace_id manquant pour les recherches privées

### 4. Gestion d'erreur non-capturée

Le code lève une erreur `MISSING_WORKSPACE_ID` mais ne capture pas tous les cas où le workspace_id pourrait être problématique.

## Solutions proposées

### Solution 1 : Validation stricte du workspace_id pour les recherches privées

```typescript
// Avant la construction des filtres
if (effectiveType === 'fullPrivate') {
  if (!clientHasWsFilter && !requestWorkspaceId) {
    throw new Error('MISSING_WORKSPACE_ID');
  }
  // Validation supplémentaire
  if (!clientHasWsFilter && requestWorkspaceId && !isUuid(requestWorkspaceId)) {
    throw new Error('INVALID_WORKSPACE_ID');
  }
}
```

### Solution 2 : Correction de l'échappement des guillemets

```typescript
case 'fullPrivate':
  if (clientHasWsFilter) {
    appliedFilters = `scope:private`;
  } else {
    // Utiliser JSON.stringify pour un échappement correct
    const wsIdEscaped = JSON.stringify(requestWorkspaceId).slice(1, -1);
    appliedFilters = `scope:private AND workspace_id:"${wsIdEscaped}"`;
  }
  break;
```

### Solution 3 : Logging amélioré pour le diagnostic

```typescript
console.log('DEBUG buildAppliedFor:', {
  searchType: stype,
  clientHasWsFilter,
  requestWorkspaceId,
  isValidUuid: requestWorkspaceId ? isUuid(requestWorkspaceId) : false,
  appliedFilters: appliedFilters // après construction
});
```

## Recommandations

1. **Ajouter une validation stricte** du workspace_id avant toute utilisation dans les filtres
2. **Corriger l'échappement** des guillemets dans les filtres Algolia
3. **Améliorer les messages d'erreur** pour faciliter le diagnostic
4. **Ajouter des logs détaillés** temporaires pour capturer les cas edge
5. **Tester avec différents scénarios** :
   - Utilisateur sans workspace
   - Utilisateur avec workspace valide
   - Utilisateur avec workspace invalide
   - Recherche publique vs privée

## Prochaines étapes

1. Implémenter les corrections dans l'Edge Function
2. Déployer la nouvelle version
3. Monitorer les logs pour vérifier la résolution
4. Retirer les logs de debug une fois le problème résolu

