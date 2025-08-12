-- Update the workspace plan for axelgirard.pro+dev@gmail.com to premium
UPDATE public.workspaces 
SET plan_type = 'premium' 
WHERE owner_id = (
  SELECT id FROM auth.users WHERE email = 'axelgirard.pro+dev@gmail.com'
);

-- Also update users table if it exists
UPDATE public.users 
SET plan_type = 'premium', subscribed = true
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'axelgirard.pro+dev@gmail.com'
);

-- Update search quotas to premium limits
UPDATE public.search_quotas 
SET 
  plan_type = 'premium',
  searches_limit = 1000,
  exports_limit = 1000
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'axelgirard.pro+dev@gmail.com'
);