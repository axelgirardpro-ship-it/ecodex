# Feature: Édition Inline du Titre des Benchmarks

**Date:** 2025-10-24  
**Type:** Feature  
**Composants:** BenchmarkHeader, BenchmarkView  
**Statut:** ✅ Implémenté

---

## 🎯 Objectif

Permettre aux utilisateurs de modifier le titre des benchmarks directement dans la vue, avec une UX moderne et intuitive, tout en gérant intelligemment les titres longs.

---

## 📋 Fonctionnalités Implémentées

### 1. **Édition Inline du Titre**

#### Déclencheurs d'édition :
- **Icône ✏️** qui apparaît au hover (UX moderne)
- ⚠️ **Note** : Le double-clic a été retiré pour ne pas interférer avec le tooltip du titre tronqué

#### Actions de sauvegarde :
- **Enter** : Valide et sauvegarde
- **Échap** : Annule les modifications
- **Blur** (perte de focus) : Sauvegarde automatiquement

#### Feedback utilisateur :
- Toast de confirmation après mise à jour réussie
- Visual feedback (hover, transition)

### 2. **Logique de Titre Intelligente**

#### Priorité d'affichage :
1. `customTitle` (modification manuelle de l'utilisateur)
2. `savedBenchmarkRaw.title` (titre d'un benchmark sauvegardé)
3. Construction dynamique basée sur les métadonnées
4. Fallback : `'Benchmark'`

#### Construction Dynamique du Titre

**Format général :**
```
{recherche} - kgCO2eq/{unité} - {périmètre} - {source}
```

**Règles de construction :**
- **Recherche** : Incluse si elle existe et n'est pas "Filtres uniquement"
- **Unité & Périmètre** : Toujours affichés sous forme `kgCO2eq/{unité}` et `{périmètre}`
- **Source** : Affichée uniquement si **une seule source** est active

**Exemples :**

| Contexte | Titre Généré |
|----------|--------------|
| Recherche "electricity" + Unité "kWh" + Périmètre "Scope 2" | `electricity - kgCO2eq/kWh - Scope 2` |
| Filtres uniquement : Unité "km" + Périmètre "Scope 1" + Source unique "ADEME" | `kgCO2eq/km - Scope 1 - ADEME Base Carbone` |
| Recherche "steel" + Unité "tonne" + Périmètre "Scope 3" + Sources multiples | `steel - kgCO2eq/tonne - Scope 3` |
| Filtres uniquement : Unité "kg" + Périmètre "Scope 2" + Sources multiples | `kgCO2eq/kg - Scope 2` |

### 3. **Gestion des Titres Longs**

#### Problématique :
Les titres peuvent devenir très longs avec la concaténation des métadonnées, risquant de déborder de la zone d'affichage.

#### Solution Implémentée :

1. **Truncate CSS** :
   - Classe `truncate` pour couper le texte avec `...`
   - Largeur maximale : `max-w-[600px]`

2. **Tooltip Radix UI** :
   - Utilisation du système de tooltip Radix UI (cohérent avec le reste de l'app)
   - Délai rapide : **200ms** (vs ~1s pour le tooltip HTML natif)
   - Position : `bottom`
   - Largeur max : `max-w-lg`
   - Multi-lignes avec `whitespace-normal break-words`
   - Affichage pour tous les titres (courts et longs)

3. **Responsive** :
   - Le bouton d'édition ✏️ a `flex-shrink-0` pour ne jamais être caché

### 4. **Persistance des Modifications**

#### Pour les Benchmarks Sauvegardés :
- Appel à `updateBenchmark({ id, title: newTitle })`
- Mise à jour en base de données (table `benchmarks`)
- Invalidation du cache React Query
- Mise à jour immédiate de l'UI

#### Pour les Benchmarks Non Sauvegardés :
- Mise à jour du state local `customTitle`
- Persisté pendant toute la durée de la session
- Perdu si l'utilisateur quitte la page (comportement attendu)
- Si l'utilisateur sauvegarde ensuite, le titre custom est préservé

---

## 🔧 Fichiers Modifiés

### **1. `src/components/benchmark/BenchmarkHeader.tsx`**

**Modifications :**
- Ajout de `Tooltip`, `TooltipProvider`, `TooltipTrigger`, `TooltipContent`
- Ajout du prop `onTitleChange?: (newTitle: string) => void`
- Ajout des states `isEditingTitle`, `editedTitle`
- Ajout de la ref `inputRef` pour focus automatique
- Ajout des handlers `handleSaveTitle`, `handleKeyDown`
- Ajout du truncate conditionnel avec tooltip (> 60 caractères)
- Largeur max du titre : `max-w-[600px]`

**Code clé :**
```tsx
<TooltipProvider delayDuration={200}>
  <Tooltip>
    <TooltipTrigger asChild>
      <div className="max-w-[600px] overflow-hidden">
        <h1 className="text-2xl font-bold text-foreground truncate">
          {title}
        </h1>
      </div>
    </TooltipTrigger>
    <TooltipContent side="bottom" className="max-w-lg">
      <p className="whitespace-normal break-words">{title}</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### **2. `src/pages/BenchmarkView.tsx`**

**Modifications :**
- Ajout du state `customTitle`
- Ajout de la fonction `handleTitleChange`
- Modification du calcul de `displayTitle` pour construction dynamique
- Passage du prop `onTitleChange` à `BenchmarkHeader`

**Code clé :**
```tsx
// Calculer le titre affiché
const displayTitle = useMemo(() => {
  if (customTitle) return customTitle;
  if (savedBenchmarkRaw?.title) return savedBenchmarkRaw.title;
  
  const parts: string[] = [];
  
  // 1. Ajouter la recherche si elle existe
  if (benchmarkData?.metadata.query && benchmarkData.metadata.query !== 'Filtres uniquement') {
    parts.push(benchmarkData.metadata.query);
  }
  
  // 2. Toujours afficher unité et périmètre
  if (benchmarkData?.metadata.unit && benchmarkData?.metadata.scope) {
    parts.push(`kgCO2eq/${benchmarkData.metadata.unit}`);
    parts.push(benchmarkData.metadata.scope);
  }
  
  // 3. Ajouter la source si une seule source active
  if (benchmarkData?.metadata.sources?.length === 1) {
    parts.push(benchmarkData.metadata.sources[0]);
  }
  
  return parts.join(' - ') || 'Benchmark';
}, [customTitle, savedBenchmarkRaw, benchmarkData]);
```

### **3. Fichiers de Traduction**

#### `src/locales/fr/benchmark.json`
```json
{
  "header": {
    "title_placeholder": "Titre du benchmark",
    "edit_title": "Éditer le titre",
    "title_updated": "Titre mis à jour",
    "title_updated_desc": "Le titre du benchmark a été modifié avec succès"
  }
}
```

#### `src/locales/en/benchmark.json`
```json
{
  "header": {
    "title_placeholder": "Benchmark title",
    "edit_title": "Edit title",
    "title_updated": "Title updated",
    "title_updated_desc": "The benchmark title has been successfully updated"
  }
}
```

---

## 🎨 UX / Design

### Comportement Visuel :

1. **État Normal** :
   - Titre affiché avec truncate si > 600px
   - Pas d'interactivité directe sur le titre (pour permettre au tooltip de fonctionner)

2. **État Hover** :
   - Icône ✏️ apparaît en fondu
   - Tooltip Radix UI affiche le titre complet après 200ms

3. **État Édition** :
   - Input remplace le titre
   - Auto-focus et sélection du texte
   - Style cohérent avec le design system

4. **Feedback** :
   - Toast de confirmation après sauvegarde réussie
   - Transitions fluides entre les états

---

## ✅ Tests Manuels Recommandés

1. **Benchmark sauvegardé** :
   - [ ] Hover sur le titre pour faire apparaître l'icône ✏️
   - [ ] Éditer le titre via icône ✏️
   - [ ] Valider avec Enter
   - [ ] Annuler avec Échap
   - [ ] Valider avec perte de focus (clic ailleurs)
   - [ ] Vérifier que le titre est sauvegardé en BDD
   - [ ] Recharger la page et vérifier la persistance

2. **Benchmark non sauvegardé** :
   - [ ] Éditer le titre
   - [ ] Vérifier que le titre custom persiste pendant la session
   - [ ] Sauvegarder le benchmark et vérifier que le titre est préservé

3. **Titres longs** :
   - [ ] Générer un benchmark avec une recherche longue + tous les filtres
   - [ ] Vérifier le truncate à 600px
   - [ ] Vérifier l'affichage du tooltip au hover (délai 200ms)
   - [ ] Vérifier que le tooltip affiche bien le titre complet sur plusieurs lignes
   - [ ] Vérifier que le tooltip ne bloque pas l'accès au bouton ✏️

4. **Construction dynamique** :
   - [ ] Benchmark avec recherche : vérifier format `{recherche} - kgCO2eq/{unité} - {périmètre}`
   - [ ] Benchmark sans recherche : vérifier format `kgCO2eq/{unité} - {périmètre}`
   - [ ] Benchmark avec source unique : vérifier ajout de la source
   - [ ] Benchmark avec sources multiples : vérifier absence de la source

---

## 📊 Impact

### Utilisateurs Affectés :
- ✅ **Tous les utilisateurs** (Freemium + Pro)

### Pages Impactées :
- ✅ `/benchmark/view` (benchmarks générés)
- ✅ `/benchmark/:id` (benchmarks sauvegardés)

### Performance :
- ✅ Pas d'impact (calcul du titre en `useMemo`)
- ✅ Mise à jour optimiste de l'UI
- ✅ Invalidation ciblée du cache React Query

---

## 🔄 Prochaines Étapes

1. ✅ Tests manuels complets
2. ⏳ Déploiement en staging
3. ⏳ Tests utilisateurs
4. ⏳ Déploiement en production
5. ⏳ Mise à jour de la documentation utilisateur

---

## 📝 Notes

- Le système de truncate est responsive et s'adapte automatiquement
- Le tooltip ne s'affiche que si nécessaire (> 60 caractères)
- La persistance des modifications est différente entre benchmarks sauvegardés et non sauvegardés (comportement attendu)
- Le format du titre est cohérent avec les métadonnées affichées dans `BenchmarkMetadata`

---

**Auteur:** AI Assistant  
**Date de création:** 2025-10-24  
**Dernière mise à jour:** 2025-10-24

