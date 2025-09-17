# Search: ranking 100% Algolia — pas de tri/filtre client, pas de cache/dédup

## 🎯 Objectif
Aligner la page Search sur un modèle simple et robuste où l’ordre des résultats est entièrement géré par Algolia (ranking), sans tri ni filtrage post‑requête côté client.

## 🔧 Changements principaux
- Suppression du tri côté Search (UI et logique):
  - Retrait du sélecteur « Trier par » et de toute propagation `sort:*` / `relevancyStrictness`.
  - Conservation du tri côté page Favoris uniquement.
- Suppression du contrôle « Résultats par page ».
- Suppression du filtrage local par plage FE (plus de `.filter(...)` sur les hits) – toute filtration se fait via Algolia.
- Rétablissement minimal de `ruleContexts` à `origin:*` pour piloter l’origine (public/private) uniquement.

- Neutralisation des mécanismes pouvant renvoyer des résultats périmés/mal classés:
  - Désactivation du cache et de la déduplication côté front (`SearchProvider`, `UnifiedAlgoliaClient`, `requestDeduplicator`, `cacheManager`).
  - Désactivation du cache côté Edge (`algolia-search-proxy`: TTL=0, `CACHE_ENABLED=false`).

## 📁 Fichiers modifiés
- `src/components/search/algolia/SearchResults.tsx`
  - Retrait du tri UI et des imports associés
  - Suppression du filtrage local FE (retrait de `useRange` et du `.filter`)
  - Le rendu s’appuie directement sur `originalHits`
- `src/components/search/algolia/AlgoliaSearchDashboard.tsx`
  - `Configure`: `hitsPerPage={36}` + `ruleContexts={[\`origin:${origin}\`]}`
- `src/lib/algolia/unifiedSearchClient.ts`, `src/components/search/algolia/SearchProvider.tsx`
  - Recherche sans cache ni déduplication
- `src/lib/algolia/requestDeduplicator.ts`, `src/lib/algolia/cacheManager.ts`
  - Dédup et cache neutralisés (no-op)
- `supabase/functions/algolia-search-proxy/index.ts`
  - Cache Edge désactivé
- `CHANGELOG.md`
  - Entrée du 2025-09-17: documente la suppression du tri/filtrages client côté Search

## ✅ Résultat attendu
- Le ranking et les filtres sont calculés côté Algolia sur l’ensemble des résultats, avant pagination, à chaque requête (pas de cache interférent). La page Search ne re-trie ni ne re-filtre les hits.

## 🧪 Tests manuels recommandés
1. Rechercher « acier » puis parcourir plusieurs pages: vérifier que l’ordre reste cohérent sans ré‑ordonnancement local.
2. Appliquer des facettes (Source, Date, Secteur…): vérifier que les résultats changent côté Algolia et pas via un post‑traitement.
3. Vérifier que la page Favoris conserve son tri local (FE/date) sans impacter la page Search.

## 🏷️ Type de changement
- [x] Simplification fonctionnelle
- [x] Robustesse / conformité avec Algolia

## 📋 Checklist
- [x] Aucun tri ni filtrage client sur la page Search
- [x] Lints OK, build OK
- [x] Docs mises à jour (CHANGELOG)
