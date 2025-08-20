-- Sécurisation de public.emission_factors_all_search
-- Objectif: empêcher toute fuite de données business (workspace_id, premium)

-- 1) Activer RLS et retirer tout accès public/anon
ALTER TABLE public.emission_factors_all_search ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.emission_factors_all_search FROM PUBLIC;
REVOKE ALL ON TABLE public.emission_factors_all_search FROM anon;

-- 2) Nettoyage d'anciennes policies trop permissives (idempotent)
DROP POLICY IF EXISTS "Public access to emission factors search" ON public.emission_factors_all_search;
DROP POLICY IF EXISTS "Authenticated users can view emission factors search" ON public.emission_factors_all_search;
DROP POLICY IF EXISTS "ef_all_select_authenticated" ON public.emission_factors_all_search;
DROP POLICY IF EXISTS "ef_all_service_full" ON public.emission_factors_all_search;

-- 3) Policies sûres
-- Accès lecture pour les utilisateurs authentifiés, limité par appartenance workspace
CREATE POLICY "ef_all_select_authenticated"
ON public.emission_factors_all_search
FOR SELECT
TO authenticated
USING (
  -- Données d’un workspace dont je suis membre
  (workspace_id IN (
     SELECT w.id
     FROM public.workspaces w
     LEFT JOIN public.user_roles ur ON ur.workspace_id = w.id
     WHERE w.owner_id = (select auth.uid()) OR ur.user_id = (select auth.uid())
  ))
  OR
  -- Données globales standard accessibles à tous les authentifiés
  (workspace_id IS NULL AND access_level = 'standard')
  OR
  -- Données premium globales accessibles uniquement si mon workspace est attribué
  (
    assigned_workspace_ids && (
      SELECT coalesce(array_agg(ur.workspace_id), '{}'::uuid[])
      FROM public.user_roles ur
      WHERE ur.user_id = (select auth.uid())
    )
  )
);

-- Accès intégral côté serveur (Edge Functions) via service_role
CREATE POLICY "ef_all_service_full"
ON public.emission_factors_all_search
AS PERMISSIVE
FOR SELECT
TO service_role
USING (true);


