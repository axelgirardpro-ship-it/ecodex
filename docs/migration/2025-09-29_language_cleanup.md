# 2025-09-29 – Nettoyage Langues

## Résumé
- Suppression des colonnes `language`/`languages` sur `emission_factors`, `fe_versions`, `data_imports`, `user_batch_algolia`, `emission_factors_all_search`.
- Recréation de la vue `emission_factors_algolia` sans champ `languages`.
- Réécriture des fonctions `rebuild_emission_factors_all_search()` et `refresh_ef_all_for_source()` (plus de calcul d’array de langues).
- Adaptation de `prepare_user_batch_projection()`.
- Retrait des fonctions `invalidate_latest_by_language*` et de la surcharge `calculate_factor_key(..., p_language text, ...)`.

## Détails techniques
- Migration `20250929_remove_languages_columns_part1` … `part4` appliquée via MCP Supabase.
- `SearchProvider` n’utilise plus `languages` dans les hits Algolia.
- Les exports/dashboards consomment les champs `Nom_fr/Nom_en` etc.

## Impact
- Conformité i18n front (sélection du champ par langue active).
- Simplification des projections Algolia.
- Réduction de la taille des documents indexés (suppression du tableau de langues).

## Suivi
- Rebuild complet : `select public.rebuild_emission_factors_all_search();`.
- Vérifier via `select * from emission_factors_all_search limit 5;` (plus de colonne `languages`).
- Edge Function `algolia-search-proxy` redéployée pour supporter les arrays correctement (`encodeParams`).
