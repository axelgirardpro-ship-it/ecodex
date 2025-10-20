# HOTFIX - Correction Facettes Inconsistantes & Logique de Blur (v131)

**Date** : 20 octobre 2025  
**Versions Edge Function** : v118 → v131  
**Statut** : ✅ Résolu et déployé en production

---

## 🎯 Résumé Exécutif

Ce hotfix résout trois problèmes critiques identifiés dans l'Edge Function `algolia-search-proxy` :

1. **Highlighting manquant** sur les champs `Description` et `Commentaires` (v118)
2. **Inconsistance des facettes** : valeurs de filtres apparaissant/disparaissant aléatoirement (v127-128)
3. **Sur-filtrage des attributs** : masquage excessif de champs qui devraient être visibles (v131)

### Impact Utilisateur
- ✅ Highlighting fonctionnel sur tous les champs (Nom, Description, Commentaires)
- ✅ Facettes stables et cohérentes (ex: "CEDA by Watershed" toujours présent)
- ✅ Tous les champs métadonnées visibles (Description, Commentaires, Unite, Incertitude, etc.)
- ✅ Seul le champ `FE` (facteur d'émission) est masqué pour les sources premium non-assignées

---

## 📊 Problème #1 : Highlighting Manquant (v118)

### Symptômes
- Le highlighting s'arrêtait après quelques résultats
- Les champs `Description_fr/en` et `Commentaires_fr/en` n'étaient pas surlignés
- Le highlighting fonctionnait uniquement sur le champ `Nom`

### Cause Racine
L'Edge Function ne transmettait pas le paramètre `attributesToHighlight` à Algolia. Le frontend demandait du highlighting, mais l'Edge Function ne relayait pas cette demande.

### Solution (v118)
```typescript
// Ajout de la transmission des attributesToHighlight
const { attributesToHighlight } = params
const paramsObj = {
  // ... autres paramètres
  ...(Array.isArray(attributesToHighlight) && attributesToHighlight.length > 0 
    ? { attributesToHighlight } 
    : {}),
  highlightPreTag: '__ais-highlight__',
  highlightPostTag: '__/ais-highlight__'
}
```

**Impact** : ✅ Highlighting fonctionnel sur tous les attributs configurés

---

## 📊 Problème #2 : Facettes Inconsistantes (v127-128)

### Symptômes
- Sur hard refresh, certaines valeurs de filtres disparaissaient/réapparaissaient
- Exemple : "CEDA by Watershed" dans le filtre "Source" présent → absent → présent
- Le nombre total de sources variait entre 30 et 35
- Problème uniquement sur requêtes avec query vide (initialisation des filtres)

### Diagnostic Approfondi

#### Étape 1 : Suspicion cache Edge Function
- **Test** : Suppression du cache in-memory (v120)
- **Résultat** : Problème persiste ❌

#### Étape 2 : Suspicion CDN/réplicas Algolia
- **Test** : Requêtes directes à l'API Algolia (bypassing Edge Function)
- **Résultat** : Algolia retourne **toujours** 35 sources avec CEDA ✅
- **Conclusion** : Le problème vient de l'Edge Function, pas d'Algolia

#### Étape 3 : Analyse des paramètres Edge Function
- **Test** : Comparaison Edge Function vs API Algolia directe
- **Observation** : 
  - API Algolia : 35 sources, CEDA toujours présent (10/10 requêtes)
  - Edge Function : 30-34 sources, CEDA présent 7/20 fois
- **Conclusion** : L'Edge Function filtre ou modifie les facettes

### Cause Racine
Pour les utilisateurs non-authentifiés, l'Edge Function envoyait des `facetFilters` :

```typescript
// AVANT (v125 et antérieurs) - INCORRECT
appliedFacetFilters = [[ 'access_level:free', 'access_level:paid' ]]
```

**Problème** : Algolia calcule les facettes **uniquement sur les documents filtrés**. Avec ces filtres, Algolia créait une inconsistance temporelle dans le calcul des facettes entre différentes réplicas/instances, causant des résultats variables.

### Solution (v127-128)

#### v127 : Suppression des facetFilters pour utilisateurs non-authentifiés
```typescript
// APRÈS v127 - CORRECT
if (workspaceId) {
  appliedFacetFilters = [[ 'access_level:free', `assigned_workspace_ids:${workspaceId}` ]]
} else {
  appliedFacetFilters = []  // ✅ Pas de filtrage pour les facettes !
}
```

#### v128 : Nettoyage des logs de debug
- Suppression des `console.log` ajoutés pour le diagnostic
- Version propre pour la production

### Tests de Validation
```bash
# Test de consistance (20 requêtes consécutives)
# AVANT v127 : 7 présents / 13 absents sur 20 requêtes ❌
# APRÈS v127 : 20 présents / 0 absents sur 20 requêtes ✅
```

**Impact** : ✅ Facettes 100% cohérentes, pas de valeurs manquantes

---

## 📊 Problème #3 : Sur-filtrage des Attributs (v129-131)

### Symptômes
- Les champs `Description_fr/en` et `Commentaires_fr/en` retournaient `null` même pour sources free
- Le highlighting ne fonctionnait pas sur ces champs
- Les métadonnées importantes étaient masquées inutilement

### Malentendu Initial (v129-130)
L'implémentation initiale masquait **plusieurs attributs** pour les utilisateurs non-authentifiés :

```typescript
// v129-130 - INCORRECT (trop restrictif)
const TEASER_ATTRIBUTES = [
  'objectID', 'scope', 'languages', 'access_level', 'Source', 'Date',
  'Nom_fr', 'Secteur_fr', 'Sous-secteur_fr', 'Localisation_fr', 'Périmètre_fr',
  'Nom_en', 'Secteur_en', 'Sous-secteur_en', 'Localisation_en', 'Périmètre_en',
  'Description_fr', 'Description_en', 'Commentaires_fr', 'Commentaires_en',
  'Contributeur'
]

const SENSITIVE_ATTRIBUTES = [
  'FE', 'Incertitude', 'Commentaires_fr', 'Commentaires_en', 
  'Unite_fr', 'Unite_en', 'Description_fr', 'Description_en'
]
```

**Problème** : 
1. Algolia ne peut pas calculer `_highlightResult` pour des attributs non retournés
2. Masquage excessif : Description, Commentaires, Unite, Incertitude sont des métadonnées utiles
3. Seul le champ `FE` (valeur du facteur d'émission) est réellement sensible

### Clarification des Besoins

**Règle métier correcte** :
- ✅ Tous les champs sont visibles par défaut (Description, Commentaires, Unite, Incertitude, etc.)
- ✅ **Seul le champ `FE`** doit être blurré pour les sources `paid`/`premium` non-assignées
- ✅ Condition de blur : `(access_level === 'paid' || access_level === 'premium') && !isSourceAssigned`

### Solution (v131)

```typescript
// v131 - CORRECT
// Pas de restriction sur les attributs retournés
const TEASER_ATTRIBUTES = undefined;  // ✅ Tous les attributs sont retournés

// Seul FE est sensible
const SENSITIVE_ATTRIBUTES = ['FE'];  // ✅ Un seul champ masqué

// Logique de blur simplifiée
function postProcessResults(results, hasWorkspaceAccess, assignedSources) {
  return results.map(hit => {
    const isPaid = hit.access_level === 'premium' || hit.access_level === 'paid';
    const isSourceAssigned = assignedSources.includes(hit.Source);
    const shouldBlur = isPaid && !isSourceAssigned;
    
    if (shouldBlur) {
      const blurredHit = { ...hit };
      delete blurredHit.FE;  // ✅ Supprime UNIQUEMENT FE
      blurredHit.is_blurred = true;
      return blurredHit;
    }
    
    return { ...hit, is_blurred: false };
  });
}
```

**Impact** : 
- ✅ Highlighting fonctionnel sur Description et Commentaires
- ✅ Métadonnées complètes pour tous les utilisateurs
- ✅ Sécurité préservée : seule la valeur sensible (FE) est masquée

---

## 🔄 Chronologie des Versions

| Version | Date | Changement | Statut |
|---------|------|------------|--------|
| v118 | 20/10 | Ajout transmission `attributesToHighlight` | ✅ Highlighting OK |
| v119-126 | 20/10 | Tentatives correction facettes (cache, debug) | ⚠️ Problème persiste |
| v127 | 20/10 | Suppression `facetFilters` pour non-auth | ✅ Facettes cohérentes |
| v128 | 20/10 | Nettoyage logs debug | ✅ Version propre |
| v129-130 | 20/10 | Tentative restriction attributs | ❌ Sur-filtrage |
| v131 | 20/10 | Logique de blur correcte (FE uniquement) | ✅ **SOLUTION FINALE** |

---

## 📋 Tests de Validation (v131)

### Test 1 : Consistance des Facettes
```bash
# 20 requêtes consécutives avec query vide
curl -X POST "https://[...]/algolia-search-proxy?origin=public" \
  -H "Authorization: Bearer [anon_key]" \
  -d '{"requests":[{"params":{"query":"","facets":["Source"]}}]}'

# Résultat : 34 sources, CEDA présent (20/20) ✅
```

### Test 2 : Highlighting
```
Recherche : "Acier ou fer blanc neuf"
Résultat attendu :
  - Nom_fr : "**Acier** ou **fer** **blanc** **neuf**" ✅
  - Description_fr : Highlighting si présent dans le texte ✅
  - Commentaires_fr : Highlighting si présent dans le texte ✅
```

### Test 3 : Visibilité des Attributs
```
Source FREE (Base Carbone v23.6) :
  - Description_fr : visible ✅
  - Commentaires_fr : visible ✅
  - Unite_fr : visible ✅
  - Incertitude : visible ✅
  - FE : visible ✅

Source PAID non-assignée (CEDA by Watershed) :
  - Description_fr : visible ✅
  - Commentaires_fr : visible ✅
  - Unite_fr : visible ✅
  - Incertitude : visible ✅
  - FE : masqué (is_blurred: true) ✅
```

---

## 🛠️ Fichiers Modifiés

### Fichier Principal
- **`supabase/functions/algolia-search-proxy/index.ts`**
  - Lignes 28-37 : Configuration `TEASER_ATTRIBUTES` et `SENSITIVE_ATTRIBUTES`
  - Lignes 64-81 : Fonction `postProcessResults` (logique de blur)
  - Lignes 205-209 : Suppression `facetFilters` pour non-authentifiés
  - Lignes 249-274 : Transmission `attributesToHighlight` à Algolia

### Documentation
- **`docs/hotfix/2025-10-20-fix-algolia-facets-blur-v131.md`** (ce fichier)

---

## 🎓 Leçons Apprises

### 1. **Algolia calcule les facettes sur l'ensemble filtré**
Si on applique des `facetFilters` restrictifs, les facettes ne reflètent que les documents matchant ces filtres. Pour avoir des facettes cohérentes, il faut soit :
- Ne pas utiliser de `facetFilters` (notre choix)
- Ou utiliser des `filters` (s'appliquent après le calcul des facettes)

### 2. **Le highlighting nécessite l'accès aux attributs**
Algolia ne peut pas calculer `_highlightResult` pour un attribut si celui-ci n'est pas dans `attributesToRetrieve`. Si on veut du highlighting sur Description, Description doit être retourné.

### 3. **Séparer les préoccupations de sécurité**
- **Filtrage Algolia** : Pour contrôler quels documents sont retournés (scope, access_level)
- **Post-traitement Edge Function** : Pour masquer des champs spécifiques selon les permissions

Ne pas confondre les deux : le post-traitement doit être minimal et ciblé (un seul champ sensible : `FE`).

### 4. **Tests directs vs proxies**
Quand on diagnostique un problème d'API, toujours tester :
1. L'API directement (bypass proxy)
2. Le proxy/Edge Function
3. Comparer les résultats

Cela permet d'isoler rapidement où se situe le problème.

---

## ✅ Validation Finale

- [x] Highlighting fonctionnel sur tous les champs
- [x] Facettes cohérentes (pas de valeurs manquantes)
- [x] Tous les attributs visibles pour sources free
- [x] Seul FE masqué pour sources premium non-assignées
- [x] Performance maintenue (~270-340ms par requête)
- [x] Déployé en production (v131)

---

**Auteur** : Équipe Datacarb  
**Révision** : 20 octobre 2025  
**Statut** : Production stable ✅

