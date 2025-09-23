# Stabilisation des IDs FE et simplification Algolia (2025-09-23)

## Résumé
- Backfill de `public.emission_factors.id` avec `gen_random_uuid()`, conversion stricte en `uuid`, défaut `gen_random_uuid()` et restauration de la clé primaire.
- Conversion de `workspace_id` en `uuid` pour supprimer les casts implicites lors des rebuilds.
- Projection `emission_factors_all_search` nettoyée : suppression de `record_id`, fonctions `rebuild`/`refresh` mises à jour, rebuild complet.
- Rebuild exécuté : 213 905 lignes projets; 0 mismatch `object_id` vs `emission_factors.id`.
- Task Algolia full reindex **non lancée** (à planifier ultérieurement).

## Étapes exécutées
1. `UPDATE public.emission_factors SET id = gen_random_uuid()` sur les 213 788 lignes non UUID.
2. `ALTER TABLE public.emission_factors`
   - `DROP CONSTRAINT` pkey (si présente), `ALTER COLUMN id TYPE uuid USING id::uuid`.
   - `ALTER COLUMN id SET DEFAULT gen_random_uuid()` et `SET NOT NULL`.
   - `ADD CONSTRAINT emission_factors_pkey PRIMARY KEY (id)`.
   - `ALTER COLUMN workspace_id TYPE uuid USING NULLIF(workspace_id,'')::uuid`.
3. Drop de la vue `emission_factors_algolia` (dépendance sur `record_id`).
4. `ALTER TABLE public.emission_factors_all_search DROP COLUMN record_id`.
5. Recréation des fonctions `rebuild_emission_factors_all_search` et `refresh_ef_all_for_source` (usage exclusif de `object_id`).
6. Rebuild complet via `SELECT public.rebuild_emission_factors_all_search();`.
7. Recréation de la vue `emission_factors_algolia` (`SELECT * FROM public.emission_factors_all_search`).

## Vérifications
- `SELECT COUNT(*) AS total FROM public.emission_factors_all_search;` → 213 905.
- `SELECT COUNT(*) FILTER (WHERE object_id IS NULL) FROM public.emission_factors_all_search;` → 0.
- `SELECT COUNT(*) FILTER (WHERE efa.object_id::text <> ef.id::text)
   FROM public.emission_factors_all_search efa
   JOIN public.emission_factors ef ON ef.id = efa.object_id;` → 0 mismatch.

## À faire
- Planifier l’exécution de la Task Algolia `419f86b4-4c35-4608-8a88-b8343a457a3a` pour propager les `objectID` stabilisés.
- Nettoyage complémentaire : `user_batch_algolia` sans `record_id`, `user_factor_overlays` sans champ CSV `"ID"`, template CSV utilisateur mis à jour (migration `20250924_cleanup_user_import_ids.sql`).
- Ajouter une vérification régulière (cron/monitoring) : `SELECT count(*) … WHERE id IS NULL` sur `emission_factors` et `emission_factors_all_search`.
