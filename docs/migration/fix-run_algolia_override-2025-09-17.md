### Fix: run_algolia_data_task_override (pg_net)

- Problème: la fonction SQL `public.run_algolia_data_task_override` utilisait `content` (ancienne signature http) alors que `pg_net.http_post` renvoie un objet avec `body`. Résultat: erreur "column \"content\" does not exist" et 502 dans le flux d'import.

- Correctif appliqué le 2025-09-17:
  - Remplacement de `SELECT content::jsonb ... FROM net.http_post(...)` par un `SELECT to_jsonb(r) ...` pour capturer la réponse complète, puis parsing de `v_http->>'body'` en JSON.
  - Audit: insertion dans `audit_logs` de la réponse complète (`http`) et du `body` parsé.
  - Conservation du fallback de credentials via Vault (`ALGOLIA_APP_ID`/`ALGOLIA_ADMIN_KEY`) si les GUC ne sont pas définies.

- Impact:
  - Plus d'erreur 502 sur `chunked-upload`/`import-csv-user` liée au RunTask.
  - RunTask Algolia fonctionne pour l'override ciblé `user_batch_algolia`.

- Déploiement:
  - Migration exécutée via MCP Supabase (fonction remplacée en place).


