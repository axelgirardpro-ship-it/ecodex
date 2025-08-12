-- Créer les nouvelles structures sans modifier l'existant pour éviter les conflits

-- Créer la table workspaces (remplace/étend companies)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'freemium',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS sur workspaces
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Policies pour workspaces
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their workspaces' AND tablename = 'workspaces') THEN
    EXECUTE 'CREATE POLICY "Users can view their workspaces" 
    ON public.workspaces 
    FOR SELECT 
    USING (
      owner_id = auth.uid() OR 
      EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = auth.uid() 
        AND user_roles.company_id = workspaces.id
      )
    )';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Owners can update their workspaces' AND tablename = 'workspaces') THEN
    EXECUTE 'CREATE POLICY "Owners can update their workspaces" 
    ON public.workspaces 
    FOR UPDATE 
    USING (owner_id = auth.uid())';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create workspaces' AND tablename = 'workspaces') THEN
    EXECUTE 'CREATE POLICY "Users can create workspaces" 
    ON public.workspaces 
    FOR INSERT 
    WITH CHECK (owner_id = auth.uid())';
  END IF;
END $$;

-- Créer la table emission_factors
CREATE TABLE IF NOT EXISTS public.emission_factors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  description TEXT,
  fe DECIMAL NOT NULL,
  unite TEXT NOT NULL,
  source TEXT NOT NULL,
  secteur TEXT NOT NULL,
  categorie TEXT NOT NULL,
  localisation TEXT NOT NULL,
  date TEXT NOT NULL,
  incertitude TEXT,
  plan_tier TEXT DEFAULT 'freemium',
  is_public BOOLEAN DEFAULT false,
  dataset_id UUID REFERENCES public.datasets(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS sur emission_factors
ALTER TABLE public.emission_factors ENABLE ROW LEVEL SECURITY;

-- Policies pour emission_factors
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view emission factors in their workspace' AND tablename = 'emission_factors') THEN
    EXECUTE 'CREATE POLICY "Users can view emission factors in their workspace" 
    ON public.emission_factors 
    FOR SELECT 
    USING (
      is_public = true OR
      workspace_id IN (
        SELECT w.id FROM workspaces w
        LEFT JOIN user_roles ur ON ur.company_id = w.id
        WHERE w.owner_id = auth.uid() OR ur.user_id = auth.uid()
      )
    )';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert emission factors in their workspace' AND tablename = 'emission_factors') THEN
    EXECUTE 'CREATE POLICY "Users can insert emission factors in their workspace" 
    ON public.emission_factors 
    FOR INSERT 
    WITH CHECK (
      workspace_id IN (
        SELECT w.id FROM workspaces w
        LEFT JOIN user_roles ur ON ur.company_id = w.id
        WHERE w.owner_id = auth.uid() OR ur.user_id = auth.uid()
      )
    )';
  END IF;
END $$;

-- Créer une table pour gérer les permissions des bases de données par plan
CREATE TABLE IF NOT EXISTS public.database_plan_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  database_name TEXT NOT NULL,
  plan_tier TEXT NOT NULL,
  accessible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(database_name, plan_tier)
);

-- Enable RLS sur database_plan_access
ALTER TABLE public.database_plan_access ENABLE ROW LEVEL SECURITY;

-- Policy pour database_plan_access
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'All users can view database access rules' AND tablename = 'database_plan_access') THEN
    EXECUTE 'CREATE POLICY "All users can view database access rules" 
    ON public.database_plan_access 
    FOR SELECT 
    USING (true)';
  END IF;
END $$;

-- Ajouter workspace_id à datasets si pas déjà présent
ALTER TABLE public.datasets ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id);

-- Trigger pour updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_workspaces_updated_at') THEN
    EXECUTE 'CREATE TRIGGER update_workspaces_updated_at
      BEFORE UPDATE ON public.workspaces
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'update_emission_factors_updated_at') THEN
    EXECUTE 'CREATE TRIGGER update_emission_factors_updated_at
      BEFORE UPDATE ON public.emission_factors
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column()';
  END IF;
END $$;