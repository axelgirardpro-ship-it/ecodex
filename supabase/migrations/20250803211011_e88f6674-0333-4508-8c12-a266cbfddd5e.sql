-- Corriger définitivement le compte axelgirard.pro@gmail.com vers premium
UPDATE public.subscribers 
SET 
  subscribed = true,
  subscription_tier = 'premium',
  plan_type = 'premium',
  subscription_end = now() + interval '1 year',
  updated_at = now()
WHERE email = 'axelgirard.pro@gmail.com';