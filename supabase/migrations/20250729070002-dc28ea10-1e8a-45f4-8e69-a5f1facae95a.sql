-- Phase 1 & 2: Architecture workspace/entreprise et tables manquantes

-- Créer la table workspaces (remplace/étend companies)
CREATE TABLE public.workspaces (
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
CREATE POLICY "Users can view their workspaces" 
ON public.workspaces 
FOR SELECT 
USING (
  owner_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.company_id = workspaces.id
  )
);

CREATE POLICY "Owners can update their workspaces" 
ON public.workspaces 
FOR UPDATE 
USING (owner_id = auth.uid());

CREATE POLICY "Users can create workspaces" 
ON public.workspaces 
FOR INSERT 
WITH CHECK (owner_id = auth.uid());

-- Créer la table emission_factors avec workspace_id et plan restrictions
CREATE TABLE public.emission_factors (
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
  plan_tier TEXT DEFAULT 'freemium', -- 'freemium', 'standard', 'premium'
  is_public BOOLEAN DEFAULT false, -- pour les données partagées
  dataset_id UUID REFERENCES public.datasets(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS sur emission_factors
ALTER TABLE public.emission_factors ENABLE ROW LEVEL SECURITY;

-- Policies pour emission_factors basées sur workspace et plan
CREATE POLICY "Users can view emission factors in their workspace" 
ON public.emission_factors 
FOR SELECT 
USING (
  -- Données publiques
  is_public = true OR
  -- Données du workspace de l'utilisateur
  workspace_id IN (
    SELECT w.id FROM workspaces w
    LEFT JOIN user_roles ur ON ur.company_id = w.id
    WHERE w.owner_id = auth.uid() OR ur.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert emission factors in their workspace" 
ON public.emission_factors 
FOR INSERT 
WITH CHECK (
  workspace_id IN (
    SELECT w.id FROM workspaces w
    LEFT JOIN user_roles ur ON ur.company_id = w.id
    WHERE w.owner_id = auth.uid() OR 
    (ur.user_id = auth.uid() AND ur.role IN ('admin', 'gestionnaire'))
  )
);

CREATE POLICY "Users can update emission factors in their workspace" 
ON public.emission_factors 
FOR UPDATE 
USING (
  workspace_id IN (
    SELECT w.id FROM workspaces w
    LEFT JOIN user_roles ur ON ur.company_id = w.id
    WHERE w.owner_id = auth.uid() OR 
    (ur.user_id = auth.uid() AND ur.role IN ('admin', 'gestionnaire'))
  )
);

CREATE POLICY "Admins can delete emission factors in their workspace" 
ON public.emission_factors 
FOR DELETE 
USING (
  workspace_id IN (
    SELECT w.id FROM workspaces w
    LEFT JOIN user_roles ur ON ur.company_id = w.id
    WHERE w.owner_id = auth.uid() OR 
    (ur.user_id = auth.uid() AND ur.role = 'admin')
  )
);

-- Ajouter le rôle super_admin
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
    CREATE TYPE user_role_enum AS ENUM ('super_admin', 'admin', 'gestionnaire', 'lecteur');
  END IF;
END $$;

-- Mettre à jour la table user_roles si elle existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'role' AND data_type = 'text') THEN
    -- Modifier le type de la colonne role
    ALTER TABLE public.user_roles ALTER COLUMN role TYPE user_role_enum USING role::user_role_enum;
  END IF;
END $$;

-- Créer une table pour gérer les permissions des bases de données par plan
CREATE TABLE public.database_plan_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  database_name TEXT NOT NULL,
  plan_tier TEXT NOT NULL, -- 'freemium', 'standard', 'premium'
  accessible BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(database_name, plan_tier)
);

-- Enable RLS sur database_plan_access
ALTER TABLE public.database_plan_access ENABLE ROW LEVEL SECURITY;

-- Policy pour database_plan_access (seuls les super_admins peuvent gérer)
CREATE POLICY "Super admins can manage database access" 
ON public.database_plan_access 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND role = 'super_admin'
  )
);

CREATE POLICY "All users can view database access rules" 
ON public.database_plan_access 
FOR SELECT 
USING (true);

-- Mettre à jour la table datasets pour inclure workspace_id
ALTER TABLE public.datasets ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id);

-- Mettre à jour les policies de datasets
DROP POLICY IF EXISTS "Users can view datasets in their companies" ON public.datasets;
DROP POLICY IF EXISTS "Users can create datasets in their companies" ON public.datasets;
DROP POLICY IF EXISTS "Users can update datasets in their companies" ON public.datasets;

CREATE POLICY "Users can view datasets in their workspace" 
ON public.datasets 
FOR SELECT 
USING (
  workspace_id IN (
    SELECT w.id FROM workspaces w
    LEFT JOIN user_roles ur ON ur.company_id = w.id
    WHERE w.owner_id = auth.uid() OR ur.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create datasets in their workspace" 
ON public.datasets 
FOR INSERT 
WITH CHECK (
  workspace_id IN (
    SELECT w.id FROM workspaces w
    LEFT JOIN user_roles ur ON ur.company_id = w.id
    WHERE w.owner_id = auth.uid() OR 
    (ur.user_id = auth.uid() AND ur.role IN ('admin', 'gestionnaire'))
  )
);

CREATE POLICY "Users can update datasets in their workspace" 
ON public.datasets 
FOR UPDATE 
USING (
  workspace_id IN (
    SELECT w.id FROM workspaces w
    LEFT JOIN user_roles ur ON ur.company_id = w.id
    WHERE w.owner_id = auth.uid() OR 
    (ur.user_id = auth.uid() AND ur.role IN ('admin', 'gestionnaire'))
  )
);

-- Trigger pour updated_at
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_emission_factors_updated_at
  BEFORE UPDATE ON public.emission_factors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_database_plan_access_updated_at
  BEFORE UPDATE ON public.database_plan_access
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Mettre à jour la fonction handle_new_user pour créer un workspace
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  workspace_id UUID;
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  
  -- Create a workspace for the new user
  INSERT INTO public.workspaces (name, owner_id, plan_type)
  VALUES (
    COALESCE(NEW.raw_user_meta_data ->> 'company', 'Mon Workspace'),
    NEW.id,
    'freemium'
  ) RETURNING id INTO workspace_id;
  
  -- Assign admin role to the new user in their workspace
  INSERT INTO public.user_roles (user_id, company_id, role, assigned_by)
  VALUES (NEW.id, workspace_id, 'admin', NEW.id);
  
  -- Insert into subscribers with freemium plan
  INSERT INTO public.subscribers (user_id, email, plan_type, trial_end)
  VALUES (
    NEW.id,
    NEW.email,
    'freemium',
    now() + interval '7 days'
  );
  
  -- Insert into search_quotas with freemium limits
  INSERT INTO public.search_quotas (user_id, plan_type)
  VALUES (NEW.id, 'freemium');
  
  RETURN NEW;
END;
$function$;