-- Durcissement RLS projections + RLS sur tables de staging/versions
-- Date: 2025-08-13

-- 1) Projections publiques/privées: restreindre l'accès PostgREST
ALTER TABLE public.emission_factors_public_search_fr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emission_factors_private_search_fr ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'emission_factors_public_search_fr' AND policyname = 'Connector can read public search projection'
  ) THEN
    DROP POLICY "Connector can read public search projection" ON public.emission_factors_public_search_fr;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'emission_factors_private_search_fr' AND policyname = 'Connector can read private search projection'
  ) THEN
    DROP POLICY "Connector can read private search projection" ON public.emission_factors_private_search_fr;
  END IF;
END $$;

-- Lecture réservée aux supra-admins (les fonctions Edge utilisent la service role)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='emission_factors_public_search_fr' AND policyname='Supra admins read public projection'
  ) THEN
    CREATE POLICY "Supra admins read public projection"
ON public.emission_factors_public_search_fr
FOR SELECT USING (is_supra_admin());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='emission_factors_private_search_fr' AND policyname='Supra admins read private projection'
  ) THEN
    CREATE POLICY "Supra admins read private projection"
ON public.emission_factors_private_search_fr
FOR SELECT USING (is_supra_admin());
  END IF;
END $$;

-- 2) RLS pour fe_versions
ALTER TABLE public.fe_versions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='fe_versions' AND policyname='Owner manages version'
  ) THEN
    CREATE POLICY "Owner manages version"
ON public.fe_versions
FOR ALL USING (created_by = auth.uid());
  END IF;
END $$;

-- 3) RLS pour emission_factors_staging
ALTER TABLE public.emission_factors_staging ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='emission_factors_staging' AND policyname='Admins manage staging by workspace'
  ) THEN
    CREATE POLICY "Admins manage staging by workspace"
ON public.emission_factors_staging
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.workspace_id = emission_factors_staging.workspace_id
      AND ur.role IN ('admin','supra_admin')
  )
);
  END IF;
END $$;


