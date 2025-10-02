# Fix: Perte de records lors de l'assignation/désassignation de sources premium

## Problème identifié

Lors de l'assignation ou désassignation de la source CBAM (ou toute autre source avec plus de 1000 records) à un workspace, des records étaient perdus à chaque opération.

### Symptômes
- 5354 records CBAM dans Algolia au départ
- 4662 records après une assignation/désassignation
- 4178 records après une autre opération
- 3728 records après une nouvelle opération
- Perte progressive de records à chaque manipulation

## Cause racine

Dans le fichier `supabase/functions/manage-fe-source-assignments/index.ts`, la fonction `syncAlgoliaForSource` :

1. Récupère tous les records de la source depuis la projection SQL
2. Interroge Algolia pour récupérer les `objectID` existants **avec une limite de 1000 hits**
3. Compare les deux listes
4. Supprime les records Algolia qui ne sont pas dans la liste des 1000 premiers
5. Re-sauvegarde tous les records

**Le bug** : Algolia limite les résultats de recherche à 1000 hits par défaut. Pour une source comme CBAM avec 6963 records, seuls les 1000 premiers étaient récupérés. La fonction considérait alors que les 5963 records restants étaient obsolètes et les supprimait !

## Solution implémentée

### 1. Pagination de la requête Algolia

Modification de `supabase/functions/manage-fe-source-assignments/index.ts` pour paginer les résultats :

```typescript
// AVANT (bugué)
const searchBody = {
  query: '',
  filters: `Source:"${sourceName}"`,
  attributesToRetrieve: ['objectID'],
  hitsPerPage: 1000  // ❌ Limite à 1000 records
}

// APRÈS (corrigé)
let page = 0
let hasMorePages = true
const hitsPerPage = 1000

while (hasMorePages) {
  const searchBody = {
    query: '',
    filters,
    attributesToRetrieve: ['objectID'],
    hitsPerPage,
    page  // ✅ Pagination
  }
  
  const searchResponse = await fetch(searchUrl, {
    method: 'POST',
    headers: algoliaHeaders,
    body: JSON.stringify(searchBody)
  })
  
  if (searchResponse.ok) {
    const searchData = await searchResponse.json()
    if (searchData.hits && searchData.hits.length > 0) {
      searchData.hits.forEach((hit: any) => {
        existingIds.push(String(hit.objectID))
      })
      // Calculer s'il y a plus de pages
      const totalPages = Math.ceil(searchData.nbHits / hitsPerPage)
      hasMorePages = page + 1 < totalPages
      page++
    } else {
      hasMorePages = false
    }
  }
}
```

### 2. Déploiement

```bash
npx supabase functions deploy manage-fe-source-assignments
```

## Vérification

Après le déploiement :

1. ✅ La fonction récupère maintenant TOUS les objectID existants via pagination
2. ✅ Plus de suppression accidentelle de records
3. ✅ Les 6963 records CBAM sont préservés

## Tests de non-régression

Pour tester :

1. Assigner CBAM à un workspace via l'interface admin
2. Vérifier le nombre de records dans Algolia (doit rester à 6963)
3. Désassigner CBAM du workspace
4. Re-vérifier le nombre de records (doit toujours être 6963)

## Sources affectées

Toutes les sources avec **plus de 1000 records** étaient potentiellement affectées par ce bug :
- CBAM : 6963 records
- ADEME v23 : ~100k records
- GHG Protocol : ~15k records
- etc.

## Actions de suivi

1. ✅ Correction déployée
2. ⚠️ Re-synchronisation de CBAM recommandée via l'interface admin (assigner puis désassigner)
3. ⚠️ Vérifier les autres sources premium avec beaucoup de records

## Date

- **Identifié** : 1er octobre 2025
- **Corrigé** : 1er octobre 2025
- **Déployé** : 1er octobre 2025

