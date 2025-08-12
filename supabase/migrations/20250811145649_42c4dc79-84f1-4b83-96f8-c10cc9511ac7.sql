-- Ajout des nouvelles colonnes de quotas dans search_quotas
ALTER TABLE public.search_quotas 
ADD COLUMN clipboard_copies_limit INTEGER DEFAULT 10,
ADD COLUMN clipboard_copies_used INTEGER DEFAULT 0,
ADD COLUMN favorites_limit INTEGER DEFAULT 10,
ADD COLUMN favorites_used INTEGER DEFAULT 0;

-- Création de la table pour gérer la période d'essai des workspaces freemium
CREATE TABLE public.workspace_trials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

-- Enable RLS sur workspace_trials
ALTER TABLE public.workspace_trials ENABLE ROW LEVEL SECURITY;

-- Politique RLS pour workspace_trials
CREATE POLICY "Users can view their workspace trial"
ON public.workspace_trials
FOR SELECT
USING (workspace_id IN (
  SELECT w.id FROM public.workspaces w 
  LEFT JOIN public.user_roles ur ON ur.workspace_id = w.id
  WHERE w.owner_id = auth.uid() OR ur.user_id = auth.uid()
));

CREATE POLICY "System can manage workspace trials"
ON public.workspace_trials
FOR ALL
USING (true);

-- Fonction pour créer automatiquement une période d'essai pour les nouveaux workspaces freemium
CREATE OR REPLACE FUNCTION public.create_workspace_trial()
RETURNS TRIGGER AS $$
BEGIN
  -- Créer une période d'essai seulement pour les plans freemium
  IF NEW.plan_type = 'freemium' THEN
    INSERT INTO public.workspace_trials (workspace_id, started_at, expires_at)
    VALUES (NEW.id, now(), now() + interval '7 days')
    ON CONFLICT (workspace_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour créer automatiquement les trials
CREATE TRIGGER create_trial_on_workspace_insert
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.create_workspace_trial();

-- Mettre à jour les quotas existants avec les nouvelles limites selon le plan
UPDATE public.search_quotas 
SET 
  searches_limit = NULL, -- Recherches illimitées pour tous les plans
  exports_limit = CASE 
    WHEN plan_type = 'freemium' THEN 10
    WHEN plan_type = 'standard' THEN 100  
    WHEN plan_type = 'premium' THEN 1000
    ELSE exports_limit
  END,
  clipboard_copies_limit = CASE 
    WHEN plan_type = 'freemium' THEN 10
    WHEN plan_type = 'standard' THEN 100
    WHEN plan_type = 'premium' THEN 1000
    ELSE 10
  END,
  favorites_limit = CASE 
    WHEN plan_type = 'freemium' THEN 10
    WHEN plan_type = 'standard' THEN 100
    WHEN plan_type = 'premium' THEN NULL -- Illimité
    ELSE 10
  END;

-- Migration des rôles "lecteur" vers "gestionnaire"
UPDATE public.user_roles 
SET role = 'gestionnaire'
WHERE role = 'lecteur';

-- Créer les trials pour les workspaces freemium existants
INSERT INTO public.workspace_trials (workspace_id, started_at, expires_at)
SELECT id, created_at, created_at + interval '7 days'
FROM public.workspaces 
WHERE plan_type = 'freemium'
ON CONFLICT (workspace_id) DO NOTHING;

-- Fonction pour vérifier si un workspace a encore accès (période d'essai)
CREATE OR REPLACE FUNCTION public.workspace_has_access(workspace_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE 
    WHEN w.plan_type = 'freemium' THEN 
      COALESCE(wt.expires_at > now(), false)
    ELSE 
      true
  END
  FROM public.workspaces w
  LEFT JOIN public.workspace_trials wt ON wt.workspace_id = w.id
  WHERE w.id = workspace_uuid;
$function$;