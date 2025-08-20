-- Supprimer définitivement l'exposition d'auth.users via les vues publiques
-- Stratégie: déplacer les vues vers un schéma interne non exposé (internal)
-- et révoquer les privilèges pour les rôles publics/clients.

CREATE SCHEMA IF NOT EXISTS internal;

DO $$
DECLARE r record;
        obj_type text;
BEGIN
  FOR r IN
    SELECT c.relname AS name, c.relkind AS kind
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('workspace_quotas_monitoring', 'workspace_summary')
      AND c.relkind IN ('v','m') -- view or materialized view
  LOOP
    obj_type := CASE r.kind WHEN 'm' THEN 'MATERIALIZED VIEW' ELSE 'VIEW' END;

    -- Révoquer tout privilège public et explicite (defense-in-depth)
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', r.name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', r.name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', r.name);

    -- Déplacer vers schéma interne non exposé à PostgREST
    EXECUTE format('ALTER %s public.%I SET SCHEMA internal', obj_type, r.name);

    -- Accès uniquement pour les rôles serveur
    EXECUTE format('GRANT SELECT ON TABLE internal.%I TO service_role', r.name);
    EXECUTE format('GRANT SELECT ON TABLE internal.%I TO supabase_admin', r.name);
  END LOOP;
END
$$;


