-- Migration pour simplifier l'architecture de base de données

-- 1. Ajouter workspace_id à la table profiles
ALTER TABLE public.profiles 
ADD COLUMN workspace_id UUID;

-- 2. Populer workspace_id dans profiles depuis user_roles
UPDATE public.profiles 
SET workspace_id = (
  SELECT ur.company_id 
  FROM public.user_roles ur 
  WHERE ur.user_id = profiles.user_id 
  LIMIT 1
);

-- 3. Rendre workspace_id obligatoire dans profiles
ALTER TABLE public.profiles 
ALTER COLUMN workspace_id SET NOT NULL;

-- 4. Ajouter une contrainte de clé étrangère
ALTER TABLE public.profiles 
ADD CONSTRAINT fk_profiles_workspace 
FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- 5. Renommer company_id en workspace_id dans user_roles
ALTER TABLE public.user_roles 
RENAME COLUMN company_id TO workspace_id;

-- 6. Renommer company_id en workspace_id dans datasets
ALTER TABLE public.datasets 
RENAME COLUMN company_id TO workspace_id;

-- 7. Renommer company_id en workspace_id dans search_history
ALTER TABLE public.search_history 
RENAME COLUMN company_id TO workspace_id;

-- 8. Renommer company_id en workspace_id dans company_invitations et renommer la table
ALTER TABLE public.company_invitations 
RENAME COLUMN company_id TO workspace_id;

ALTER TABLE public.company_invitations 
RENAME TO workspace_invitations;

-- 9. Migrer les données de global_user_roles vers user_roles
INSERT INTO public.user_roles (user_id, workspace_id, role, assigned_by, created_at, updated_at)
SELECT 
  user_id,
  NULL as workspace_id, -- Les rôles globaux n'ont pas de workspace spécifique
  role,
  assigned_by,
  created_at,
  updated_at
FROM public.global_user_roles;

-- 10. Permettre workspace_id d'être NULL dans user_roles pour les rôles globaux
ALTER TABLE public.user_roles 
ALTER COLUMN workspace_id DROP NOT NULL;

-- 11. Supprimer la table global_user_roles
DROP TABLE public.global_user_roles;

-- 12. Supprimer la table companies (après avoir vérifié que toutes les données sont migrées)
DROP TABLE public.companies;

-- 13. Mettre à jour les fonctions pour utiliser workspace_id au lieu de company_id

-- Fonction has_company_access devient has_workspace_access
CREATE OR REPLACE FUNCTION public.has_workspace_access(workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND workspace_id = $1
  );
END;
$function$;

-- Fonction is_company_owner devient is_workspace_owner
CREATE OR REPLACE FUNCTION public.is_workspace_owner(workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE id = workspace_id AND owner_id = auth.uid()
  );
END;
$function$;

-- Fonction is_supra_admin mise à jour pour utiliser user_roles
CREATE OR REPLACE FUNCTION public.is_supra_admin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_uuid AND role = 'supra_admin' AND workspace_id IS NULL
  );
$function$;

-- 14. Mettre à jour les politiques RLS pour utiliser les nouvelles fonctions et colonnes

-- Mettre à jour les politiques de la table datasets
DROP POLICY IF EXISTS "Users can create datasets in their companies" ON public.datasets;
DROP POLICY IF EXISTS "Users can update datasets in their companies" ON public.datasets;
DROP POLICY IF EXISTS "Users can view datasets in their companies" ON public.datasets;

CREATE POLICY "Users can create datasets in their workspaces" 
ON public.datasets 
FOR INSERT 
WITH CHECK (
  (user_id = auth.uid()) AND 
  ((workspace_id IS NULL) OR (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND workspace_id = datasets.workspace_id 
    AND role = ANY (ARRAY['admin'::text, 'gestionnaire'::text])
  )))
);

CREATE POLICY "Users can update datasets in their workspaces" 
ON public.datasets 
FOR UPDATE 
USING (
  (user_id = auth.uid()) OR (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND workspace_id = datasets.workspace_id 
    AND role = ANY (ARRAY['admin'::text, 'gestionnaire'::text])
  ))
);

CREATE POLICY "Users can view datasets in their workspaces" 
ON public.datasets 
FOR SELECT 
USING (
  (user_id = auth.uid()) OR (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND workspace_id = datasets.workspace_id
  ))
);

-- Mettre à jour les politiques de la table search_history
DROP POLICY IF EXISTS "Users can insert their own search history" ON public.search_history;

CREATE POLICY "Users can insert their own search history" 
ON public.search_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Mettre à jour les politiques de la table workspace_invitations (anciennement company_invitations)
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.workspace_invitations;
DROP POLICY IF EXISTS "Users can view invitations for their companies" ON public.workspace_invitations;

CREATE POLICY "Admins can manage workspace invitations" 
ON public.workspace_invitations 
FOR ALL 
USING (
  (EXISTS (
    SELECT 1 FROM workspaces 
    WHERE id = workspace_invitations.workspace_id AND owner_id = auth.uid()
  )) OR (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND workspace_id = workspace_invitations.workspace_id 
    AND role = 'admin'::text
  ))
);

CREATE POLICY "Users can view workspace invitations" 
ON public.workspace_invitations 
FOR SELECT 
USING (
  (email = auth.email()) OR 
  (EXISTS (
    SELECT 1 FROM workspaces 
    WHERE id = workspace_invitations.workspace_id AND owner_id = auth.uid()
  )) OR (EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() AND workspace_id = workspace_invitations.workspace_id 
    AND role = 'admin'::text
  ))
);

-- Mettre à jour les politiques de la table user_roles
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view roles in their companies" ON public.user_roles;

CREATE POLICY "Admins can manage user roles" 
ON public.user_roles 
FOR ALL 
USING (
  (workspace_id IS NULL AND is_supra_admin()) OR 
  (workspace_id IS NOT NULL AND (
    is_workspace_owner(workspace_id) OR 
    (EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() AND ur.workspace_id = user_roles.workspace_id 
      AND ur.role = 'admin'::text
    ))
  ))
);

CREATE POLICY "Users can view roles in their workspaces" 
ON public.user_roles 
FOR SELECT 
USING (
  (user_id = auth.uid()) OR 
  (workspace_id IS NULL AND is_supra_admin()) OR 
  (workspace_id IS NOT NULL AND (
    is_workspace_owner(workspace_id) OR 
    (EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() AND ur.workspace_id = user_roles.workspace_id 
      AND ur.role = 'admin'::text
    ))
  ))
);

-- Supprimer les anciennes fonctions qui ne sont plus nécessaires
DROP FUNCTION IF EXISTS public.has_company_access(uuid);
DROP FUNCTION IF EXISTS public.is_company_owner(uuid);