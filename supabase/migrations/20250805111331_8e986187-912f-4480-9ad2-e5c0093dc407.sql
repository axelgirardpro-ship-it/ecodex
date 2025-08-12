-- Migration pour restructurer les données utilisateur
-- Les workspaces portent les abonnements, les user_roles définissent les rôles

-- 1. Supprimer la colonne role de la table users
ALTER TABLE public.users DROP COLUMN IF EXISTS role;

-- 2. Recréer la table users avec la nouvelle structure (profile + plan du workspace)
DROP TABLE IF EXISTS public.users_new;
CREATE TABLE public.users_new (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  first_name text,
  last_name text,
  company text,
  position text,
  phone text,
  email text NOT NULL,
  plan_type text NOT NULL DEFAULT 'freemium',
  subscribed boolean DEFAULT false,
  subscription_tier text,
  trial_end timestamp with time zone,
  subscription_end timestamp with time zone,
  assigned_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, workspace_id)
);

-- 3. Migrer les données depuis user_roles + profiles + subscribers + workspaces
INSERT INTO public.users_new (
  user_id, workspace_id, first_name, last_name, company, position, phone,
  email, plan_type, subscribed, subscription_tier, trial_end, subscription_end,
  assigned_by, created_at, updated_at
)
SELECT DISTINCT
  ur.user_id,
  ur.workspace_id,
  COALESCE(p.first_name, ''),
  COALESCE(p.last_name, ''),
  COALESCE(p.company, w.name),
  COALESCE(p.position, ''),
  COALESCE(p.phone, ''),
  COALESCE(s.email, ''),
  COALESCE(w.plan_type, 'freemium'),
  COALESCE(s.subscribed, false),
  w.subscription_tier,
  s.trial_end,
  s.subscription_end,
  ur.assigned_by,
  LEAST(ur.created_at, COALESCE(p.created_at, ur.created_at), COALESCE(s.created_at, ur.created_at)),
  GREATEST(ur.updated_at, COALESCE(p.updated_at, ur.updated_at), COALESCE(s.updated_at, ur.updated_at))
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.user_id = ur.user_id AND p.workspace_id = ur.workspace_id
LEFT JOIN public.subscribers s ON s.user_id = ur.user_id AND s.workspace_id = ur.workspace_id
LEFT JOIN public.workspaces w ON w.id = ur.workspace_id
WHERE ur.workspace_id IS NOT NULL;

-- 4. Remplacer l'ancienne table users par la nouvelle
DROP TABLE public.users;
ALTER TABLE public.users_new RENAME TO users;

-- 5. Recréer les contraintes et index
CREATE INDEX idx_users_user_id ON public.users(user_id);
CREATE INDEX idx_users_workspace_id ON public.users(workspace_id);
CREATE INDEX idx_users_email ON public.users(email);

-- 6. Activer RLS sur la nouvelle table users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 7. Recréer les politiques RLS pour la table users
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

-- Admins can manage users in their workspace
CREATE POLICY "Admins can manage users in their workspace" 
ON public.users 
FOR ALL 
USING (workspace_id IN (
  SELECT ur.workspace_id FROM user_roles ur 
  WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'supra_admin')
));

-- Supra admins can manage all users
CREATE POLICY "Supra admins can manage all users" 
ON public.users 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() AND ur.role = 'supra_admin'
));

-- 8. Créer un trigger pour updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Supprimer les anciennes tables devenues inutiles
DROP TABLE IF EXISTS public.profiles;
DROP TABLE IF EXISTS public.subscribers;