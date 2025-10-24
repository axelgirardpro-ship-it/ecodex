# ✅ Checklist de Tests - Phase 1 Corrections Critiques

## 🎯 Objectif
Vérifier que les corrections de Phase 1 n'ont introduit **aucune régression fonctionnelle**.

---

## 📋 Tests par Catégorie

### 1️⃣ Edge Functions Modifiées (Priorité HAUTE)

Ces Edge Functions ont eu des modifications de code (pas seulement des commentaires).

#### ✅ `algolia-run-task` (Modifié: @ts-ignore → @ts-expect-error)
**Endpoint :** POST `/algolia-run-task`

**Ce qui a changé :**
- Directives TypeScript pour Deno.env
- Aucun changement de logique métier

**Tests à effectuer :**
```bash
# Test 1: Déclencher une tâche Algolia depuis l'admin
```
- [ ] Se connecter en tant que super admin
- [ ] Aller dans l'interface admin Algolia tasks
- [ ] Déclencher une tâche de réindexation manuelle
- [ ] ✅ Vérifier que la tâche se lance sans erreur
- [ ] ✅ Vérifier les logs dans Supabase Edge Functions
- [ ] ✅ Vérifier qu'Algolia a bien reçu la tâche

**Erreurs possibles si ça casse :**
- `Deno is not defined`
- `Cannot read env variables`

---

#### ✅ `schedule-source-reindex` (Modifié: triple slash reference)
**Endpoint :** POST `/schedule-source-reindex`

**Ce qui a changé :**
- Import de types (/// <reference> → import type)
- Aucun changement de logique métier

**Tests à effectuer :**
```bash
# Test 1: Planifier une réindexation de source
```
- [ ] Se connecter en tant que super admin
- [ ] Aller dans la gestion des sources
- [ ] Déclencher une réindexation de source spécifique
- [ ] ✅ Vérifier que la planification fonctionne
- [ ] ✅ Vérifier les logs Supabase

**Erreurs possibles si ça casse :**
- Erreurs de types TypeScript
- `serve is not defined`

---

### 2️⃣ Frontend - Hooks React (Priorité CRITIQUE)

Ces modifications touchent aux règles fondamentales de React.

#### ✅ `useSafeLanguage` Hook
**Fichier :** `src/hooks/useSafeLanguage.ts`

**Ce qui a changé :**
- Hook `useLanguage()` maintenant appelé inconditionnellement
- Gestion d'erreur après l'appel du hook

**Tests à effectuer :**
- [ ] **Test 1 : Changement de langue**
  - [ ] Se connecter à l'application
  - [ ] Cliquer sur le sélecteur de langue (FR/EN)
  - [ ] ✅ Vérifier que la langue change sans erreur
  - [ ] ✅ Vérifier qu'il n'y a pas d'erreur console

- [ ] **Test 2 : Navigation entre pages**
  - [ ] Naviguer entre : Recherche → Favoris → Benchmarks
  - [ ] ✅ Vérifier que la langue reste stable
  - [ ] ✅ Pas d'erreur "Cannot read properties of undefined"

- [ ] **Test 3 : Rafraîchissement de page**
  - [ ] Rafraîchir la page (F5)
  - [ ] ✅ Vérifier que la langue persiste
  - [ ] ✅ Pas d'erreur au chargement

**Erreurs possibles si ça casse :**
- `useLanguage is not a function`
- `Cannot read property 'language' of undefined`
- Infinite re-render loops

---

#### ✅ `FavorisSearchBox` Component
**Fichier :** `src/components/search/favoris/FavorisSearchBox.tsx`

**Ce qui a changé :**
- Hook `useSearchControls()` appelé au top-level au lieu d'IIFE
- Gestion d'erreur avec try/catch

**Tests à effectuer :**
- [ ] **Test 1 : Page Favoris - Recherche basique**
  - [ ] Aller sur la page Favoris
  - [ ] ✅ Vérifier que la page charge sans erreur
  - [ ] Taper "scope 1" dans la barre de recherche
  - [ ] Cliquer sur "Rechercher"
  - [ ] ✅ Vérifier que les résultats s'affichent
  - [ ] ✅ Vérifier le compteur de résultats

- [ ] **Test 2 : Clear search**
  - [ ] Effectuer une recherche
  - [ ] Cliquer sur le bouton X (clear)
  - [ ] ✅ Vérifier que le champ se vide
  - [ ] ✅ Vérifier que tous les favoris réapparaissent

- [ ] **Test 3 : Recherche avec Enter**
  - [ ] Taper une recherche
  - [ ] Appuyer sur Enter
  - [ ] ✅ Vérifier que la recherche se lance
  - [ ] ✅ Pas d'erreur "useSearchControls is not defined"

**Erreurs possibles si ça casse :**
- `useSearchControls() called in wrong context`
- `controls is null` sans gestion
- Recherche ne se lance pas

---

#### ✅ `FavorisSearchResults` Component
**Fichier :** `src/components/search/favoris/FavorisSearchResults.tsx`

**Ce qui a changé :**
- Hook `useLanguage()` appelé inconditionnellement
- Gestion d'erreur après l'appel

**Tests à effectuer :**
- [ ] **Test 1 : Affichage des résultats**
  - [ ] Aller sur Favoris avec quelques favoris
  - [ ] ✅ Vérifier que les résultats s'affichent
  - [ ] ✅ Vérifier que les noms sont dans la bonne langue
  - [ ] ✅ Vérifier Description, Commentaires, etc.

- [ ] **Test 2 : Changement de langue dans les résultats**
  - [ ] Afficher des favoris
  - [ ] Changer la langue FR ↔ EN
  - [ ] ✅ Vérifier que les champs se traduisent
  - [ ] ✅ Pas d'erreur de re-render

- [ ] **Test 3 : Interactions avec les résultats**
  - [ ] Cocher/décocher des items
  - [ ] Retirer des favoris
  - [ ] Exporter la sélection
  - [ ] ✅ Vérifier que tout fonctionne
  - [ ] ✅ Pas d'erreur console

- [ ] **Test 4 : Pagination**
  - [ ] Si plus de 20 favoris, naviguer entre pages
  - [ ] ✅ Vérifier que la pagination fonctionne
  - [ ] ✅ Vérifier que la langue reste cohérente

**Erreurs possibles si ça casse :**
- `useLanguage() rendered more hooks than previous render`
- Champs non traduits
- Crash lors du changement de langue

---

### 3️⃣ Corrections TypeScript Frontend (Priorité MOYENNE)

#### ✅ `main.tsx` (trustedTypes)
**Tests à effectuer :**
- [ ] **Test 1 : Chargement initial**
  - [ ] Ouvrir l'app dans Chrome
  - [ ] Ouvrir DevTools Console
  - [ ] ✅ Pas d'erreur "trustedTypes" au chargement
  - [ ] ✅ Vérifier dans Firefox/Safari aussi

- [ ] **Test 2 : Console propre**
  - [ ] ✅ Aucune erreur rouge au démarrage
  - [ ] ✅ Aucun warning TypeScript runtime

---

#### ✅ `searchClient.ts` (regex escape)
**Fichier :** `src/lib/algolia/searchClient.ts`

**Tests à effectuer :**
- [ ] **Test 1 : Recherche avec favoris**
  - [ ] Ajouter des items aux favoris
  - [ ] Aller sur la page Favoris
  - [ ] ✅ Vérifier que les favoris s'affichent
  - [ ] ✅ Pas d'erreur de parsing des UUIDs

---

#### ✅ `tailwind.config.ts` (import vs require)
**Tests à effectuer :**
- [ ] **Test 1 : Build de production**
  ```bash
  npm run build
  ```
  - [ ] ✅ Le build passe sans erreur
  - [ ] ✅ Pas d'erreur "require() is not defined"
  - [ ] ✅ Les animations Tailwind fonctionnent

- [ ] **Test 2 : Dev mode**
  ```bash
  npm run dev
  ```
  - [ ] ✅ Le serveur dev démarre
  - [ ] ✅ Animations CSS visibles (accordéons, hovers)

---

### 4️⃣ Edge Functions avec @ts-nocheck Documenté (Priorité BASSE)

Ces fichiers ont seulement reçu des commentaires TODO, pas de changement de code.

#### ℹ️ Tests optionnels (si temps disponible)

- [ ] `algolia-search-proxy` : Faire une recherche normale
- [ ] `chunked-upload` : Upload un fichier CSV (admin)
- [ ] `generate-benchmark` : Générer un benchmark
- [ ] `import-csv-user` : Importer un CSV utilisateur
- [ ] `invite-user` : Inviter un utilisateur dans un workspace

**Note :** Ces fonctions devraient fonctionner normalement car seuls les commentaires ont changé.

---

## 🚨 Signes d'Alerte (Red Flags)

Si vous voyez ces erreurs, il y a un problème :

### Erreurs React Hooks
```
❌ Error: Rendered more hooks than during the previous render
❌ Error: Hooks can only be called inside the body of a function component
❌ Error: Cannot read property 'language' of undefined (dans useSafeLanguage)
```

### Erreurs Edge Functions
```
❌ Deno is not defined
❌ serve is not defined
❌ Cannot access env variables
```

### Erreurs TypeScript
```
❌ require() is not defined (tailwind.config)
❌ trustedTypes error in main.tsx
```

---

## ✅ Validation Finale

Avant de merger la branche `fix/lint-phase1-critical` :

### Tests Automatiques
```bash
# 1. Vérifier le linting
npm run lint
# ✅ Doit afficher "384 problems" (pas plus, pas moins)

# 2. Vérifier le build
npm run build
# ✅ Doit passer sans erreur

# 3. Vérifier TypeScript
npx tsc --noEmit
# ℹ️ Peut avoir des erreurs (normal avec @ts-nocheck)
```

### Tests Manuels Minimum
- [ ] ✅ Recherche fonctionne (page principale)
- [ ] ✅ Favoris fonctionne (ajout/retrait/affichage)
- [ ] ✅ Changement de langue FR/EN fonctionne
- [ ] ✅ Aucune erreur console rouge au chargement
- [ ] ✅ Navigation entre pages fluide

### Tests Admin (si accès)
- [ ] ✅ Import CSV utilisateur fonctionne
- [ ] ✅ Gestion des workspaces fonctionne
- [ ] ✅ Réindexation Algolia fonctionne

---

## 📊 Rapport de Test

Une fois les tests effectués, remplir ce template :

```markdown
## Tests Phase 1 - Résultats

**Date :** [DATE]
**Testeur :** [NOM]
**Branche :** fix/lint-phase1-critical
**Commit :** 0a7d9483

### ✅ Tests Réussis
- [ ] Hooks React (useSafeLanguage, FavorisSearchBox, FavorisSearchResults)
- [ ] Edge Functions (algolia-run-task, schedule-source-reindex)
- [ ] Build & Lint
- [ ] Navigation et UX

### ❌ Tests Échoués
[Lister les problèmes trouvés]

### 📝 Notes
[Observations particulières]

### 🎯 Décision
- [ ] ✅ Prêt à merger
- [ ] ⚠️ Corrections mineures nécessaires
- [ ] ❌ Rollback nécessaire
```

---

## 🔄 En Cas de Problème

Si un test échoue :

1. **Ne pas paniquer** - Les backups existent :
   ```bash
   git checkout backup/main-before-lint-fixes
   # ou
   git checkout v-before-lint-fixes-2025-10-24
   ```

2. **Documenter l'erreur** :
   - Screenshot de l'erreur console
   - Steps pour reproduire
   - Fichier/fonction concerné

3. **Analyser la cause** :
   - Comparer avec le backup
   - Vérifier les logs Supabase
   - Tester isolément le composant

4. **Corriger ou rollback** selon la gravité

---

## 🎯 Priorités de Test

**CRITIQUE (à tester obligatoirement) :**
1. ✅ Hooks React (useSafeLanguage, FavorisSearchBox, FavorisSearchResults)
2. ✅ Changement de langue
3. ✅ Page Favoris complète

**IMPORTANT (fortement recommandé) :**
4. ✅ Edge Functions (algolia-run-task, schedule-source-reindex)
5. ✅ Build production

**OPTIONNEL (si temps) :**
6. ℹ️ Autres Edge Functions
7. ℹ️ Tests de charge

