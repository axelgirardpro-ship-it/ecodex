-- Migration pour restructurer les données utilisateur - Partie 2
-- Finaliser la migration et corriger les problèmes de sécurité

-- 1. Remplacer l'ancienne table users par la nouvelle
DROP TABLE public.users;
ALTER TABLE public.users_new RENAME TO users;

-- 2. Recréer les contraintes et index
CREATE INDEX idx_users_user_id ON public.users(user_id);
CREATE INDEX idx_users_workspace_id ON public.users(workspace_id);
CREATE INDEX idx_users_email ON public.users(email);

-- 3. Activer RLS sur la nouvelle table users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 4. Recréer les politiques RLS pour la table users (maintenant basées sur user_roles)
-- Users can view their own data
CREATE POLICY "Users can view their own data" 
ON public.users 
FOR SELECT 
USING (user_id = auth.uid());

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" 
ON public.users 
FOR UPDATE 
USING (user_id = auth.uid());

-- Users can view users in their workspace
CREATE POLICY "Users can view users in their workspace" 
ON public.users 
FOR SELECT 
USING (workspace_id IN (
  SELECT w.id FROM workspaces w 
  LEFT JOIN users u ON u.workspace_id = w.id 
  WHERE u.user_id = auth.uid()
));

-- Admins can manage users in their workspace (now using user_roles table)
CREATE POLICY "Admins can manage users in their workspace" 
ON public.users 
FOR ALL 
USING (workspace_id IN (
  SELECT ur.workspace_id FROM user_roles ur 
  WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'supra_admin')
));

-- Supra admins can manage all users (now using user_roles table)
CREATE POLICY "Supra admins can manage all users" 
ON public.users 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() AND ur.role = 'supra_admin'
));

-- 5. Créer un trigger pour updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Supprimer les anciennes tables devenues inutiles
DROP TABLE IF EXISTS public.profiles;
DROP TABLE IF EXISTS public.subscribers;