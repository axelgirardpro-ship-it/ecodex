-- Remettre le bon statut premium pour axelgirard.pro@gmail.com
UPDATE public.subscribers 
SET 
  subscribed = true,
  subscription_tier = 'Premium',
  plan_type = 'premium',
  subscription_end = now() + interval '1 year',
  updated_at = now()
WHERE email = 'axelgirard.pro@gmail.com';