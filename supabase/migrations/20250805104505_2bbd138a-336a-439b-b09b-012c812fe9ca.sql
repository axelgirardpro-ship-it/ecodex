-- Phase 1: Créer la table users unifiée
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE, -- Référence à auth.users
  workspace_id UUID NOT NULL,
  
  -- Informations de profil (depuis profiles)
  first_name TEXT,
  last_name TEXT,
  company TEXT,
  position TEXT,
  phone TEXT,
  
  -- Informations d'abonnement (depuis subscribers, sans Stripe)
  email TEXT NOT NULL,
  plan_type TEXT DEFAULT 'freemium'::text,
  subscribed BOOLEAN DEFAULT false,
  subscription_tier TEXT,
  trial_end TIMESTAMP WITH TIME ZONE,
  subscription_end TIMESTAMP WITH TIME ZONE,
  
  -- Informations de rôle (depuis user_roles)
  role TEXT NOT NULL,
  assigned_by UUID,
  
  -- Métadonnées
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Contraintes
  CONSTRAINT fk_workspace FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE
);

-- Index pour optimiser les requêtes fréquentes
CREATE INDEX idx_users_user_id ON public.users(user_id);
CREATE INDEX idx_users_workspace_id ON public.users(workspace_id);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_email ON public.users(email);

-- Activer RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour la table users
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
  SELECT w.id FROM workspaces w 
  LEFT JOIN users u ON u.workspace_id = w.id 
  WHERE u.user_id = auth.uid()
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

-- Fonction pour migrer les données
CREATE OR REPLACE FUNCTION migrate_to_unified_users() 
RETURNS VOID AS $$
DECLARE
  profile_rec RECORD;
  subscriber_rec RECORD;
  role_rec RECORD;
BEGIN
  -- Migrer depuis user_roles (table principale avec workspace_id)
  FOR role_rec IN 
    SELECT DISTINCT ON (ur.user_id, ur.workspace_id) 
           ur.user_id, ur.workspace_id, ur.role, ur.assigned_by, ur.created_at, ur.updated_at
    FROM user_roles ur 
    WHERE ur.workspace_id IS NOT NULL
    ORDER BY ur.user_id, ur.workspace_id, ur.created_at DESC
  LOOP
    -- Récupérer les données de profil
    SELECT * INTO profile_rec 
    FROM profiles 
    WHERE user_id = role_rec.user_id AND workspace_id = role_rec.workspace_id
    LIMIT 1;
    
    -- Récupérer les données d'abonnement
    SELECT * INTO subscriber_rec 
    FROM subscribers 
    WHERE user_id = role_rec.user_id AND workspace_id = role_rec.workspace_id
    LIMIT 1;
    
    -- Si pas de subscriber, chercher par user_id seulement
    IF subscriber_rec IS NULL THEN
      SELECT * INTO subscriber_rec 
      FROM subscribers 
      WHERE user_id = role_rec.user_id
      LIMIT 1;
    END IF;
    
    -- Insérer dans la nouvelle table
    INSERT INTO public.users (
      user_id, workspace_id, role, assigned_by,
      first_name, last_name, company, position, phone,
      email, plan_type, subscribed, subscription_tier, trial_end, subscription_end,
      created_at, updated_at
    ) VALUES (
      role_rec.user_id,
      role_rec.workspace_id,
      role_rec.role,
      role_rec.assigned_by,
      COALESCE(profile_rec.first_name, ''),
      COALESCE(profile_rec.last_name, ''),
      COALESCE(profile_rec.company, ''),
      COALESCE(profile_rec.position, ''),
      COALESCE(profile_rec.phone, ''),
      COALESCE(subscriber_rec.email, ''),
      COALESCE(subscriber_rec.plan_type, 'freemium'),
      COALESCE(subscriber_rec.subscribed, false),
      subscriber_rec.subscription_tier,
      subscriber_rec.trial_end,
      subscriber_rec.subscription_end,
      LEAST(role_rec.created_at, COALESCE(profile_rec.created_at, role_rec.created_at), COALESCE(subscriber_rec.created_at, role_rec.created_at)),
      GREATEST(role_rec.updated_at, COALESCE(profile_rec.updated_at, role_rec.updated_at), COALESCE(subscriber_rec.updated_at, role_rec.updated_at))
    )
    ON CONFLICT (user_id, workspace_id) DO NOTHING;
  END LOOP;
  
  -- Gérer les supra_admins (sans workspace_id)
  FOR role_rec IN 
    SELECT ur.user_id, ur.role, ur.assigned_by, ur.created_at, ur.updated_at
    FROM user_roles ur 
    WHERE ur.workspace_id IS NULL AND ur.role = 'supra_admin'
  LOOP
    -- Récupérer les données d'abonnement pour email
    SELECT * INTO subscriber_rec 
    FROM subscribers 
    WHERE user_id = role_rec.user_id
    LIMIT 1;
    
    -- Créer un workspace temporaire ou utiliser le premier workspace trouvé
    DECLARE
      default_workspace_id UUID;
    BEGIN
      SELECT id INTO default_workspace_id FROM workspaces LIMIT 1;
      
      INSERT INTO public.users (
        user_id, workspace_id, role, assigned_by,
        email, plan_type, subscribed,
        created_at, updated_at
      ) VALUES (
        role_rec.user_id,
        default_workspace_id,
        role_rec.role,
        role_rec.assigned_by,
        COALESCE(subscriber_rec.email, ''),
        'premium', -- Supra admins ont accès premium
        true,
        role_rec.created_at,
        role_rec.updated_at
      )
      ON CONFLICT (user_id, workspace_id) DO NOTHING;
    END;
  END LOOP;
  
  RAISE NOTICE 'Migration completed successfully';
END;
$$ LANGUAGE plpgsql;

-- Trigger pour maintenir updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();