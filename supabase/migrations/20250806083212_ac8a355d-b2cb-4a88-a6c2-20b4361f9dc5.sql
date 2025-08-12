-- Assign guillaumears44@gmail.com to Global Administration workspace
-- First, insert or update in users table
INSERT INTO public.users (
  user_id, 
  workspace_id, 
  email,
  plan_type,
  subscribed,
  assigned_by
)
VALUES (
  '1cb0d91a-31cf-4ea5-aa4b-e91ca0c0a674',
  'de960863-892c-45e2-8288-b9bbc69bc03b',
  'guillaumears44@gmail.com',
  'premium',
  true,
  'e6e2e278-14e9-44fd-86ff-28da775f43c6'
)
ON CONFLICT (user_id, workspace_id) 
DO UPDATE SET 
  plan_type = 'premium',
  subscribed = true,
  updated_at = now();

-- Assign admin role in Global Administration workspace
INSERT INTO public.user_roles (
  user_id, 
  workspace_id, 
  role, 
  assigned_by
)
VALUES (
  '1cb0d91a-31cf-4ea5-aa4b-e91ca0c0a674',
  'de960863-892c-45e2-8288-b9bbc69bc03b',
  'admin',
  'e6e2e278-14e9-44fd-86ff-28da775f43c6'
)
ON CONFLICT (user_id, workspace_id) 
DO UPDATE SET 
  role = 'admin',
  updated_at = now();

-- Update search quotas to premium
INSERT INTO public.search_quotas (
  user_id, 
  plan_type, 
  searches_limit, 
  exports_limit,
  searches_used,
  exports_used
)
VALUES (
  '1cb0d91a-31cf-4ea5-aa4b-e91ca0c0a674',
  'premium',
  NULL,
  NULL,
  0,
  0
)
ON CONFLICT (user_id) 
DO UPDATE SET 
  plan_type = 'premium',
  searches_limit = NULL,
  exports_limit = NULL,
  updated_at = now();