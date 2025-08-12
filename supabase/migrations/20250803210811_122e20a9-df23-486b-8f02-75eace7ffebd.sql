-- Corriger le plan_type du compte axelgirard.pro@gmail.com vers premium

UPDATE public.subscribers 
SET 
  subscribed = true,
  subscription_tier = 'Premium',
  plan_type = 'premium',
  subscription_end = now() + interval '1 year',
  updated_at = now()
WHERE email = 'axelgirard.pro@gmail.com' AND user_id = 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7';