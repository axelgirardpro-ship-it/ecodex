-- Corriger l'erreur de policy en supprimant d'abord les policies existantes

-- Supprimer les policies existantes sur user_roles qui référencent la colonne role
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view roles in their companies" ON public.user_roles;

-- Créer le type enum pour les rôles
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
    CREATE TYPE user_role_enum AS ENUM ('super_admin', 'admin', 'gestionnaire', 'lecteur');
  END IF;
END $$;

-- Modifier le type de la colonne role maintenant que les policies sont supprimées
ALTER TABLE public.user_roles ALTER COLUMN role TYPE user_role_enum USING role::user_role_enum;

-- Recréer les policies avec le nouveau type
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