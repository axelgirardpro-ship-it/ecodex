# Fix: Recherche bloquée sur la première lettre et filtres inopérants (cache/dédup Algolia)

## 🎯 Problème résolu
- La saisie dans la searchbox se figeait après le premier caractère (ex: « banane » déclenchait une recherche sur « b » uniquement)
- Les filtres Algolia (facettes, numériques…) ne relançaient plus la recherche

## 🔧 Solution implémentée
- Correction des clés de cache et de déduplication afin d’inclure les paramètres contenus dans `request.params` (InstantSearch) quand les champs top‑level sont absents.
  - Avant: les clés n’utilisaient que `request.query/filters/facetFilters` top‑level ⇒ toutes les requêtes se dédupliquaient/cachaient sur la 1ère saisie.
  - Après: fallback systématique sur `request.params.query/filters/facetFilters/hitsPerPage/page` ⇒ la recherche suit bien la saisie complète et tout changement de filtre invalide la clé.

## 📁 Fichiers modifiés

### Frontend (React/TypeScript)
- `src/lib/algolia/cacheManager.ts`
  - Nouvelle génération de clé avec fallback sur `params.*`
- `src/lib/algolia/requestDeduplicator.ts`
  - Nouvelle clé de dédup + clé de batch basées sur `params.query` si présent

### Backend (Supabase Edge Functions)
- Aucune modification nécessaire; le proxy conserve la propagation des paramètres.

## ✅ Résultats
- La searchbox ne reste plus bloquée sur la 1ère lettre
- Les filtres re-déclenchent correctement les requêtes Algolia

## 🧪 Tests effectués
- Taper « banane »: la requête suit bien la saisie (b → ba → ban …)
- Activation de filtres (Source, Date…): résultats mis à jour instantanément

## 🔧 Notes d’implémentation
- Aucun paramétrage additionnel requis.

## 🎉 Résultat
- Expérience de recherche fluide et fiable; moins de faux positifs de dédup, cache plus précis.

## 🏷️ Type de changement
- [x] Bug fix (cache/dédup)
- [x] Amélioration de l'expérience utilisateur (search/filtres)

## 📋 Checklist
- [x] Le code suit les standards du projet
- [x] Auto-review effectué
- [x] Tests manuels effectués avec succès
- [x] Pas de régression sur les fonctionnalités existantes
