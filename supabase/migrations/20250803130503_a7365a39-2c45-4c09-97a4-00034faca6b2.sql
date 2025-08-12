-- Migration finale pour supprimer complètement companies et ses dépendances

-- 1. Supprimer la table companies avec CASCADE (cela supprimera automatiquement toutes les dépendances)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
        DROP TABLE public.companies CASCADE;
    END IF;
END $$;

-- 2. Maintenant supprimer les anciennes fonctions en toute sécurité
DROP FUNCTION IF EXISTS public.has_company_access(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_company_owner(uuid) CASCADE;

-- 3. Recréer les nouvelles politiques RLS pour les tables qui en ont besoin

-- Politiques pour workspace_invitations (si la table existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspace_invitations') THEN
        -- Créer les nouvelles politiques pour workspace_invitations
        DROP POLICY IF EXISTS "Admins can manage workspace invitations" ON public.workspace_invitations;
        DROP POLICY IF EXISTS "Users can view workspace invitations" ON public.workspace_invitations;
        
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
    END IF;
END $$;

-- 4. Mettre à jour les politiques de user_roles
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view roles in their workspaces" ON public.user_roles;

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