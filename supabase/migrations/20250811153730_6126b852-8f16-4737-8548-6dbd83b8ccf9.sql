-- Corriger la fonction create_workspace_trial avec search_path approprié
CREATE OR REPLACE FUNCTION public.create_workspace_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Créer une période d'essai seulement pour les plans freemium
  IF NEW.plan_type = 'freemium' THEN
    INSERT INTO public.workspace_trials (workspace_id, started_at, expires_at)
    VALUES (NEW.id, now(), now() + interval '7 days')
    ON CONFLICT (workspace_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;