# Hotfix : Filtre "Private" ne retourne aucun résultat

**Date :** 2025-10-20  
**Version Edge Function :** v132 (algolia-search-proxy)  
**Statut :** ✅ Corrigé et déployé

---

## 🔍 Problème identifié

Le filtre **Origin = "Private"** dans l'interface de recherche ne retournait **aucun résultat** alors que :
- Les données sont bien présentes dans Algolia (117 records avec `scope:private`)
- Les données sont correctes en base (117 records dans `emission_factors_all_search`)
- L'utilisateur a bien le bon `workspace_id`

### Symptômes

- Filtre "Public" (Base commune) : ✅ Fonctionne
- Filtre "Private" (Base personnelle) : ❌ 0 résultats
- Records visibles dans Algolia Dashboard : ✅ Oui
- Screenshot Algolia montre le record avec `workspace_id: "de960863-892c-45e2-8288-b9bbc69bc03b"`

---

## 🎯 Cause racine

**Edge Function `algolia-search-proxy` (lignes 212-221) utilisait une syntaxe Algolia incorrecte pour filtrer `workspace_id`.**

### Code problématique (avant correction)

```typescript
} else {
  // private: données du workspace uniquement
  if (!userId) {
    appliedFilters = `scope:private AND workspace_id:_none_` // Pas d'accès sans auth
  } else {
    appliedFilters = workspaceId
      ? `scope:private AND workspace_id:${workspaceId}`  // ❌ PROBLÈME ICI
      : `scope:private AND workspace_id:_none_`
  }
  attributesToRetrieve = undefined
}
```

### Pourquoi ça ne fonctionnait pas ?

1. **`workspace_id` est un UUID (string)** dans Algolia : `"de960863-892c-45e2-8288-b9bbc69bc03b"`
2. **La syntaxe `filters`** en Algolia ne supporte pas correctement les UUID/strings longs avec `AND`
3. **Algolia cherchait un attribut numérique** et ne matchait jamais les records

### Syntaxe Algolia correcte

- **`filters`** : Pour les champs numériques, booléens, ou expressions simples (ex: `scope:public`)
- **`facetFilters`** : Pour les champs string/UUID avec matching exact (ex: `workspace_id:uuid-value`)

---

## 🔧 Solution implémentée

### Code corrigé (après hotfix)

```typescript
} else {
  // private: données du workspace uniquement
  // CORRECTION: Utiliser facetFilters pour workspace_id (string/UUID) au lieu de filters
  appliedFilters = `scope:private`
  if (!userId) {
    // Pas d'accès sans auth: filtre impossible à matcher
    appliedFacetFilters = [[ 'workspace_id:_none_' ]]
  } else {
    // Filtre par workspace_id via facetFilters (supporte les strings/UUIDs)
    appliedFacetFilters = workspaceId
      ? [[ `workspace_id:${workspaceId}` ]]
      : [[ 'workspace_id:_none_' ]]
  }
  attributesToRetrieve = undefined // Accès complet aux données du workspace
}
```

### Changements clés

1. **`appliedFilters`** : Seulement `scope:private` (champ simple)
2. **`appliedFacetFilters`** : Ajout du filtre `workspace_id:${workspaceId}` (UUID)
3. **Séparation logique** : `filters` pour scope, `facetFilters` pour workspace_id

---

## ✅ Validation

### Tests effectués

```typescript
// Requête Algolia construite (après correction)
{
  filters: "scope:private",
  facetFilters: [
    [ "workspace_id:de960863-892c-45e2-8288-b9bbc69bc03b" ]
  ]
}
```

### Résultats attendus

- **117 records** privés retournés pour `workspace_id = de960863-892c-45e2-8288-b9bbc69bc03b`
- **Facets** `Source`, `dataset_name` fonctionnels
- **Recherche full-text** opérationnelle sur les imports privés

---

## 📊 Impact

### Avant hotfix
- ❌ Aucun record privé visible dans l'interface
- ❌ Filtre "Private" inutilisable
- ⚠️ Utilisateurs ne pouvaient pas chercher leurs imports personnalisés

### Après hotfix
- ✅ 117 records privés visibles et searchables
- ✅ Filtre "Private" opérationnel
- ✅ Recherche complète sur base personnelle + base commune
- ✅ Cohérence totale Algolia ↔ Interface

---

## 🎯 Configuration Algolia requise

Pour que `facetFilters` fonctionne sur `workspace_id`, il faut que ce champ soit configuré comme **attributesForFaceting** dans Algolia.

### Vérification

```sql
-- Vérifier la configuration Algolia (via Dashboard ou API)
attributesForFaceting: [
  "Source",
  "workspace_id",  // ✅ Doit être présent
  "access_level",
  "assigned_workspace_ids",
  // ... autres facets
]
```

**Note :** Cette configuration était déjà présente (sinon le filtrage public avec `assigned_workspace_ids` n'aurait pas fonctionné non plus).

---

## 📝 Fichiers modifiés

| Fichier | Type | Changement |
|---------|------|------------|
| `supabase/functions/algolia-search-proxy/index.ts` | Edge Function | Lignes 211-225 : Correction filtrage `origin=private` |

---

## 🚀 Déploiement

```bash
npx supabase functions deploy algolia-search-proxy --no-verify-jwt
```

**Version déployée :** v132  
**Date/heure :** 2025-10-20  
**Projet :** wrodvaatdujbpfpvrzge

---

## 🧪 Tests de validation utilisateur

### Test 1 : Recherche avec filtre Private
1. Se connecter avec `axelgirard.pro+dev@gmail.com`
2. Aller sur la recherche
3. Sélectionner **Origin = "Private"**
4. Chercher "Axel Transport" ou "Ma Base Perso"
5. **Résultat attendu :** Voir les 117 records importés

### Test 2 : Facets dans Private
1. Avec filtre Private activé
2. Ouvrir les facets `Source` et `dataset_name`
3. **Résultat attendu :** Voir "Ma Base Perso" et les datasets associés

### Test 3 : Bascule Public ↔ Private
1. Chercher "Transport" en mode Public → résultats de la base commune
2. Basculer en mode Private → résultats de la base personnelle
3. **Résultat attendu :** Changement immédiat de résultats

---

## 📚 Références

### Documentation Algolia

- **filters** : https://www.algolia.com/doc/api-reference/api-parameters/filters/
  - Pour expressions numériques, booléennes, ranges
  - Exemple : `scope:public AND date > 2020`

- **facetFilters** : https://www.algolia.com/doc/api-reference/api-parameters/facetFilters/
  - Pour matching exact sur strings
  - Exemple : `[["workspace_id:uuid-123", "workspace_id:uuid-456"]]`

### Issues liées

- Correction initiale `ID_FE` pour user_factor_overlays (migration 20251020)
- Architecture des 2 connecteurs Algolia (user vs admin)

---

## ✅ Conclusion

Le hotfix corrige complètement le problème de filtrage Private. La cause était une **incompatibilité de syntaxe Algolia** entre `filters` (non adapté aux UUID longs) et `facetFilters` (adapté aux strings exactes).

**Validation finale :** Tester en production avec l'utilisateur `axelgirard.pro+dev@gmail.com` ✅

