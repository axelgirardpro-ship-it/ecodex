-- Supprimer toutes les policies qui référencent la colonne role avant de la modifier

-- Policies sur user_roles
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view roles in their companies" ON public.user_roles;

-- Policies sur datasets qui référencent role
DROP POLICY IF EXISTS "Users can create datasets in their companies" ON public.datasets;
DROP POLICY IF EXISTS "Users can update datasets in their companies" ON public.datasets;

-- Policies sur autres tables qui pourraient référencer role
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Owners can update their companies" ON public.companies;
DROP POLICY IF EXISTS "Users can view their own companies" ON public.companies;

-- Créer le type enum pour les rôles
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
    CREATE TYPE user_role_enum AS ENUM ('super_admin', 'admin', 'gestionnaire', 'lecteur');
  END IF;
END $$;

-- Modifier le type de la colonne role
ALTER TABLE public.user_roles ALTER COLUMN role TYPE user_role_enum USING role::user_role_enum;

-- Recréer toutes les policies

-- Policies pour user_roles
CREATE POLICY "Admins can manage user roles" 
ON public.user_roles 
FOR ALL 
USING (
  -- Company owners can manage roles
  EXISTS (
    SELECT 1 FROM workspaces w 
    WHERE w.id = user_roles.company_id AND w.owner_id = auth.uid()
  ) OR
  -- Admin users can manage roles
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.company_id = user_roles.company_id 
    AND ur.role = 'admin'
  )
);

CREATE POLICY "Users can view roles in their workspaces" 
ON public.user_roles 
FOR SELECT 
USING (
  -- User can see their own role
  user_id = auth.uid() OR
  -- Company owners can see all roles
  EXISTS (
    SELECT 1 FROM workspaces w 
    WHERE w.id = user_roles.company_id AND w.owner_id = auth.uid()
  ) OR
  -- Admin users can see all roles in their workspace
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.company_id = user_roles.company_id 
    AND ur.role = 'admin'
  )
);

-- Policies pour companies (compatibilité)
CREATE POLICY "Owners can update their companies" 
ON public.companies 
FOR UPDATE 
USING (owner_id = auth.uid());

CREATE POLICY "Users can create companies" 
ON public.companies 
FOR INSERT 
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can view their own companies" 
ON public.companies 
FOR SELECT 
USING (
  owner_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.company_id = companies.id
  )
);

-- Policies pour datasets (mises à jour pour workspaces)
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