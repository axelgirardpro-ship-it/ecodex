-- Sécurité & Performance: corrections suite aux advisors Supabase
-- 1) Verrouiller l'accès des vues publiques sensibles et activer security_invoker si disponible
DO $$
BEGIN
  -- public.workspace_quotas_monitoring
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'workspace_quotas_monitoring' AND c.relkind IN ('v','m')
  ) THEN
    REVOKE ALL ON TABLE public.workspace_quotas_monitoring FROM anon;
    GRANT SELECT ON TABLE public.workspace_quotas_monitoring TO authenticated;
    BEGIN
      ALTER VIEW public.workspace_quotas_monitoring SET (security_invoker = true);
    EXCEPTION WHEN others THEN
      NULL; -- ignore si l'option n'est pas supportée par la version de Postgres
    END;
  END IF;

  -- public.workspace_summary
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'workspace_summary' AND c.relkind IN ('v','m')
  ) THEN
    REVOKE ALL ON TABLE public.workspace_summary FROM anon;
    GRANT SELECT ON TABLE public.workspace_summary TO authenticated;
    BEGIN
      ALTER VIEW public.workspace_summary SET (security_invoker = true);
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;

  -- public.system_health_check
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'system_health_check' AND c.relkind IN ('v','m')
  ) THEN
    REVOKE ALL ON TABLE public.system_health_check FROM anon;
    GRANT SELECT ON TABLE public.system_health_check TO authenticated;
    BEGIN
      ALTER VIEW public.system_health_check SET (security_invoker = true);
    EXCEPTION WHEN others THEN
      NULL;
    END;
  END IF;
END
$$;

-- 2) RLS: optimiser policies sur search_history (initplan + rôles explicites)
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

-- Nettoyage des anciennes policies pour éviter les doublons implicites (anon/authenticated/etc.)
DROP POLICY IF EXISTS "Users can insert their own search history" ON public.search_history;
DROP POLICY IF EXISTS "Users can view their own search history" ON public.search_history;
DROP POLICY IF EXISTS "Supra admins can view all search history" ON public.search_history;
DROP POLICY IF EXISTS "insert_own_search_history" ON public.search_history;
DROP POLICY IF EXISTS "select_own_search_history" ON public.search_history;
DROP POLICY IF EXISTS "select_search_history_as_supra" ON public.search_history;
DROP POLICY IF EXISTS "service_role_full_access_search_history" ON public.search_history;

-- Evite l'initplan: utiliser (select auth.uid()) pour éviter la réévaluation par ligne
CREATE POLICY "insert_own_search_history"
ON public.search_history
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "select_own_search_history"
ON public.search_history
AS PERMISSIVE
FOR SELECT
TO authenticated
USING ((select auth.uid()) = user_id OR public.is_supra_admin((select auth.uid())));

-- Accès complet pour service_role (intégrations/edge)
CREATE POLICY "service_role_full_access_search_history"
ON public.search_history
AS PERMISSIVE
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 3) Index dupliqué: conserver idx_search_history_user_created et supprimer l'alternative
DROP INDEX IF EXISTS public.idx_search_history_user_created_at;

-- 4) Stabiliser le search_path des fonctions signalées (évite le search_path dépendant du rôle)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'get_workspace_quotas',
        'ensure_user_quotas',
        'get_quota_limits',
        'on_workspace_plan_change',
        'on_user_workspace_change',
        'audit_and_fix_all_quotas',
        'cleanup_invalid_users',
        'update_user_quotas_from_workspace',
        'sync_workspace_user_quotas'
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public', r.nspname, r.proname, r.args);
  END LOOP;
END
$$;

-- 5) (Optionnel) Index non utilisés signalés: à supprimer après 7+ jours d'observation (pg_stat_statements)
-- DROP INDEX IF EXISTS public.idx_fe_source_workspace_assignments_workspace_id;
-- DROP INDEX IF EXISTS public.idx_fe_source_workspace_assignments_workspace_source;
-- DROP INDEX IF EXISTS public.idx_fe_source_workspace_assignments_source_name;
-- DROP INDEX IF EXISTS public.idx_fe_source_workspace_assignments_created_at;
-- DROP INDEX IF EXISTS public.idx_datasets_workspace_user;
-- DROP INDEX IF EXISTS public.idx_emission_factors_workspace_dataset;
-- DROP INDEX IF EXISTS public.idx_users_user_id;
-- DROP INDEX IF EXISTS public.idx_users_workspace_id;
-- DROP INDEX IF EXISTS public.idx_users_email;
-- DROP INDEX IF EXISTS public.idx_emission_factors_factor_key;
-- DROP INDEX IF EXISTS public.idx_emission_factors_is_latest;
-- DROP INDEX IF EXISTS public.idx_emission_factors_language;
-- DROP INDEX IF EXISTS public.idx_fe_versions_created_at;
-- DROP INDEX IF EXISTS public.idx_fe_versions_language;
-- DROP INDEX IF EXISTS public.idx_data_imports_workspace_created;
-- DROP INDEX IF EXISTS public.idx_data_imports_status;
-- DROP INDEX IF EXISTS public.idx_data_imports_version_id;
-- DROP INDEX IF EXISTS public.ef_all_scope_idx;
-- DROP INDEX IF EXISTS public.ef_all_workspace_idx;
-- DROP INDEX IF EXISTS public.ef_all_languages_gin;
-- DROP INDEX IF EXISTS public.ef_staging_job_idx;
-- DROP INDEX IF EXISTS public.ef_scd2_partial_idx;


