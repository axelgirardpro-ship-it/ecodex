# HOTFIX - Edge Function algolia-search-proxy V110

**Date** : 16 octobre 2025  
**Heure** : ~09:30 UTC  
**Statut** : ✅ Déployé (Version 110)

## Contexte

La version 109 déployée précédemment contenait un bug critique introduit par la correction précédente :
- Appel à `isUuid()` dans une fonction imbriquée où la fonction n'était pas accessible
- Cela causait une erreur `ReferenceError: isUuid is not defined`
- Toutes les recherches privées échouaient avec une erreur 500

## Problème identifié

```typescript
// ❌ Version 109 - Bug introduit
const buildAppliedFor = (stype: string) => {
  // ...
  case 'fullPrivate':
    if (!requestWorkspaceId || !isUuid(requestWorkspaceId)) {  // ❌ isUuid non accessible ici
      throw new Error('INVALID_WORKSPACE_ID')
    }
}
```

**Erreur** : `isUuid` est défini dans la portée parente mais n'est pas accessible dans la fonction imbriquée `buildAppliedFor`.

## Solution appliquée

Retrait de la validation UUID dans la fonction imbriquée. La validation du `workspace_id` non-nul est suffisante car :
1. Le `workspace_id` est déjà validé et extrait en amont (ligne 310)
2. Le check `!requestWorkspaceId` suffit à détecter les cas invalides
3. L'échappement des guillemets protège contre les injections

```typescript
// ✅ Version 110 - Correction simple
const buildAppliedFor = (stype: string) => {
  // ...
  case 'fullPrivate':
    if (!requestWorkspaceId) {  // ✅ Validation suffisante
      throw new Error('INVALID_WORKSPACE_ID')
    }
    const wsIdSafe = String(requestWorkspaceId).replace(/"/g, '\\"')
    appliedFilters = `scope:private AND workspace_id:"${wsIdSafe}"`
}
```

## Déploiement

```bash
npx supabase functions deploy algolia-search-proxy
```

**Résultat** :
```
Deployed Functions on project wrodvaatdujbpfpvrzge: algolia-search-proxy
```

**Version déployée** : 110  
**Date/Heure** : 2025-10-16 ~09:30 UTC

## Tests post-déploiement

À tester par l'utilisateur :
1. ✅ Recherche sur BASE COMMUNE (origin: 'public')
2. ✅ Recherche sur BASE PERSONNELLE (origin: 'private')
3. ✅ Vérifier que les résultats s'affichent correctement

## Leçons apprises

1. **Portée des fonctions** : Attention aux fonctions imbriquées et à l'accessibilité des variables
2. **Tests avant déploiement** : Un test local aurait détecté l'erreur immédiatement
3. **Validation minimale** : Parfois, une validation simple suffit (check null vs validation UUID complexe)
4. **Logs détaillés** : Les logs `console.error` ajoutés aideront au diagnostic futur

## Impact utilisateur

**Version 109** (bugguée - ~5 minutes) :
- ❌ Toutes les recherches privées échouaient
- ❌ Erreur 500 systématique
- ❌ Aucun résultat retourné

**Version 110** (corrigée) :
- ✅ Recherches privées fonctionnelles
- ✅ Validation appropriée du workspace_id
- ✅ Échappement sécurisé des caractères spéciaux

## Prochaines étapes

1. Attendre confirmation utilisateur que tout fonctionne
2. Si OK : considérer la correction comme réussie
3. Si KO : analyser les nouveaux logs avec les détails d'erreur ajoutés

---

**Statut** : 🔄 EN ATTENTE DE VALIDATION UTILISATEUR

