## 2025-09-10

- Import utilisateur stabilisé
  - Réinitialisation au démarrage: ajout d'un RPC `reset_user_import_tables()` (TRUNCATE `staging_user_imports`, `user_batch_algolia`, `staging_emission_factors`).
  - Edge `import-csv-user` v13: appelle le reset en début de flux; parse robuste; staging par chunks; projection; lancement de la Task Algolia; finalisation sans cleanup.
  - Forçage du champ `Source` = `dataset_name` partout (staging, projection, Algolia) via code Edge et trigger `trg_staging_force_source`.
  - `prepare_user_batch_projection`: purge par `TRUNCATE` (remplace `DELETE ... WHERE` à l'origine du 500) et `Source` forcée au `dataset_name`.
  - Overlays non destructifs: `batch_upsert_user_factor_overlays` en INSERT-only; historique conservé dans `user_factor_overlays`.
  - `chunked-upload`: délégation propre à `import-csv-user` (plus d'accès direct BD), évite anciens flux cassés.

- Sécurisation Algolia (admin & privé)
  - SQL `run_algolia_data_task(...)` lit désormais `ALGOLIA_APP_ID` / `ALGOLIA_ADMIN_KEY` depuis Vault et appelle directement l'API Data Ingestion (RunTask) via `pg_net` (plus de dépendance GUC).
  - Flux privé: `import-csv-user` ne lit plus d'env `ALGOLIA_*`; l'appel de Task passe via RPC SQL (`run_algolia_data_task_override`) qui s'appuie sur Vault.
  - Ajout des secrets Vault recommandés: `ALGOLIA_APP_ID`, `ALGOLIA_ADMIN_KEY`, `SUPABASE_URL`, `service_role_key`.

## 2025-09-11

- Favoris (imports privés)
  - Front: correction du filtre favoris — `objectID` est maintenant quoté dans les filtres Algolia pour éviter les erreurs de parsing.
  - SQL: nouvelle version de `add_import_overlays_to_favorites(user_id, workspace_id, dataset_name)` retournant `jsonb` et insérant `item_id = user_batch_algolia.object_id` (au lieu d'un ID composite). Remap des entrées legacy prévu.
  - Ops: nettoyage des favoris legacy pour le dataset de test "Import 2 du 11 Septembre".

- Front-end Import
  - Message “Erreurs d'import”: affichage uniquement si `importStatus === "error"` (plus d'affichage fantôme en succès).
  - Indexation Algolia: bandeau d'état non bloquant.

- Divers
  - Wrapper `refresh_projection_for_source` -> `refresh_ef_all_for_source`.
  - Auto-assign des sources restreint à `is_global = true` et `access_level = 'standard'`.


## 2025-09-17

- Edge Functions
  - `import-csv-user` v15: correction BOOT_ERROR en supprimant un doublon de fonction et en chargeant `xlsx` dynamiquement via `await import(...)` (évite un échec de démarrage si le module n'est pas résolu au boot).
  - `chunked-upload`: délégation inchangée, mais renverra désormais l'erreur applicative de l'Edge import si présente.

- Supabase SQL (pg_net / Vault)
  - `run_algolia_data_task_override`: corrige l'utilisation de `pg_net.http_post` en lisant `body` (au lieu de `content`) et journalise la réponse `http` + `body` en `audit_logs`. Conserve fallback des credentials via Vault (`ALGOLIA_APP_ID`/`ALGOLIA_ADMIN_KEY`).

- Import utilisateur (robustesse)
  - Respect strict du champ `Source` tel que fourni dans le CSV (suppression du trigger de forçage et projection mise à jour antérieurement).
  - Favoris automatiques: retries jusqu'à disponibilité des `object_id` dans `user_batch_algolia` via RPC `add_import_overlays_to_favorites`.

