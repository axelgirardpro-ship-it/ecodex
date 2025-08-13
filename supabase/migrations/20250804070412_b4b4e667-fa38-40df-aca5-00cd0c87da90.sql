-- Triggers d'auto-assignation standard
DO $$
BEGIN
  -- Trigger: à la création d'un workspace, assigner toutes les sources standard globales
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tr_ws_auto_assign_standard'
  ) THEN
    CREATE OR REPLACE FUNCTION public.ws_auto_assign_standard()
    RETURNS trigger AS $$
    BEGIN
      INSERT INTO public.fe_source_workspace_assignments (source_name, workspace_id, assigned_by)
      SELECT fs.source_name, NEW.id, NEW.owner_id
      FROM public.fe_sources fs
      WHERE fs.is_global = true AND fs.access_level = 'standard'
      ON CONFLICT DO NOTHING;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql SECURITY DEFINER;

    CREATE TRIGGER tr_ws_auto_assign_standard
    AFTER INSERT ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.ws_auto_assign_standard();
  END IF;

  -- Trigger: à l'insertion d'une source standard, assigner à tous les workspaces
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tr_fe_assign_on_insert_standard'
  ) THEN
    CREATE OR REPLACE FUNCTION public.fe_assign_on_insert_standard()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.is_global = true AND NEW.access_level = 'standard' THEN
        INSERT INTO public.fe_source_workspace_assignments (source_name, workspace_id)
        SELECT NEW.source_name, w.id FROM public.workspaces w
        ON CONFLICT DO NOTHING;
      END IF;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql SECURITY DEFINER;

    CREATE TRIGGER tr_fe_assign_on_insert_standard
    AFTER INSERT ON public.fe_sources
    FOR EACH ROW EXECUTE FUNCTION public.fe_assign_on_insert_standard();
  END IF;

  -- Trigger: si une source passe premium->standard, assigner aux workspaces manquants
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tr_fe_assign_on_update_to_standard'
  ) THEN
    CREATE OR REPLACE FUNCTION public.fe_assign_on_update_to_standard()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.is_global = true AND NEW.access_level = 'standard' AND OLD.access_level <> 'standard' THEN
        INSERT INTO public.fe_source_workspace_assignments (source_name, workspace_id)
        SELECT NEW.source_name, w.id FROM public.workspaces w
        ON CONFLICT DO NOTHING;
      END IF;
      RETURN NEW;
    END; $$ LANGUAGE plpgsql SECURITY DEFINER;

    CREATE TRIGGER tr_fe_assign_on_update_to_standard
    AFTER UPDATE OF access_level ON public.fe_sources
    FOR EACH ROW EXECUTE FUNCTION public.fe_assign_on_update_to_standard();
  END IF;
END $$;
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