-- Examiner la structure actuelle de la table users
DROP TABLE IF EXISTS public.users CASCADE;

-- Recréer la table users unifiée correctement
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- Pas de contrainte unique ici
  workspace_id UUID NOT NULL,
  
  -- Informations de profil
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  position TEXT,
  phone TEXT,
  
  -- Informations d'abonnement (sans Stripe)
  email TEXT NOT NULL,
  plan_type TEXT DEFAULT 'freemium'::text,
  subscribed BOOLEAN DEFAULT false,
  subscription_tier TEXT,
  trial_end TIMESTAMP WITH TIME ZONE,
  subscription_end TIMESTAMP WITH TIME ZONE,
  
  -- Informations de rôle
  role TEXT NOT NULL,
  assigned_by UUID,
  
  -- Métadonnées
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Contrainte unique sur la combinaison user_id + workspace_id
  CONSTRAINT unique_user_workspace UNIQUE (user_id, workspace_id),
  
  -- Contrainte de clé étrangère
  CONSTRAINT fk_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE
);

-- Index pour optimiser les requêtes
CREATE INDEX idx_users_user_id ON public.users(user_id);
CREATE INDEX idx_users_workspace_id ON public.users(workspace_id);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_email ON public.users(email);

-- Activer RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Politiques RLS
CREATE POLICY "Users can view their own data" 
ON public.users 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own profile" 
ON public.users 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can view users in their workspace" 
ON public.users 
FOR SELECT 
USING (workspace_id IN (
  SELECT workspace_id FROM users 
  WHERE user_id = auth.uid()
));

CREATE POLICY "Admins can manage users in their workspace" 
ON public.users 
FOR ALL 
USING (workspace_id IN (
  SELECT workspace_id FROM users 
  WHERE user_id = auth.uid() AND role IN ('admin', 'supra_admin')
));

CREATE POLICY "Supra admins can manage all users" 
ON public.users 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM users 
  WHERE user_id = auth.uid() AND role = 'supra_admin'
));

-- Trigger pour updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Maintenant migrer les données
SELECT migrate_to_unified_users_simple();