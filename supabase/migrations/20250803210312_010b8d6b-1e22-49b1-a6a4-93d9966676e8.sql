-- Mise à jour du compte axelgirard.pro@gmail.com vers le plan premium

-- 1. Mettre à jour la table subscribers
UPDATE public.subscribers 
SET 
  subscribed = true,
  subscription_tier = 'Premium',
  plan_type = 'premium',
  subscription_end = now() + interval '1 year',
  updated_at = now()
WHERE email = 'axelgirard.pro@gmail.com';

-- 2. Mettre à jour les quotas de recherche (illimitées pour premium)
UPDATE public.search_quotas 
SET 
  searches_limit = -1,  -- -1 = illimité
  exports_limit = -1,   -- -1 = illimité
  plan_type = 'premium',
  updated_at = now()
WHERE user_id = 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7';

-- 3. Mettre à jour le workspace/company vers premium
UPDATE public.companies 
SET 
  plan_type = 'premium',
  updated_at = now()
WHERE owner_id = 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7';

UPDATE public.workspaces 
SET 
  plan_type = 'premium',
  updated_at = now()
WHERE owner_id = 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7';

-- 4. Log de l'action dans l'audit trail
INSERT INTO public.audit_logs (user_id, action, details)
VALUES (
  'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7',
  'plan_upgrade',
  jsonb_build_object(
    'from_plan', 'freemium',
    'to_plan', 'premium',
    'upgraded_by', 'admin',
    'upgrade_date', now()
  )
);