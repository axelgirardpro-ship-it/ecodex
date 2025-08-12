-- Phase 1: Correction des politiques RLS manquantes

-- Table workspace_invitations: Ajouter les politiques RLS manquantes
CREATE POLICY "Workspace owners can manage invitations" 
ON public.workspace_invitations 
FOR ALL 
USING (
  workspace_id IN (
    SELECT id FROM public.workspaces 
    WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  workspace_id IN (
    SELECT id FROM public.workspaces 
    WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Admins can manage workspace invitations" 
ON public.workspace_invitations 
FOR ALL 
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can view invitations sent to them" 
ON public.workspace_invitations 
FOR SELECT 
USING (email = auth.email());

-- Phase 3: Configuration Auth SSO seulement
-- Configuration pour désactiver l'auth email/password et activer SSO
-- Note: Ces changements seront reflétés dans config.toml

-- Phase 3: Amélioration sécurité Auth
-- Configurer les paramètres de sécurité Auth via des fonctions système si disponibles