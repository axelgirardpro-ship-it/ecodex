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

- Front-end Import
  - Message “Erreurs d'import”: affichage uniquement si `importStatus === "error"` (plus d'affichage fantôme en succès).
  - Indexation Algolia: bandeau d'état non bloquant.

- Divers
  - Wrapper `refresh_projection_for_source` -> `refresh_ef_all_for_source`.
  - Auto-assign des sources restreint à `is_global = true` et `access_level = 'standard'`.


