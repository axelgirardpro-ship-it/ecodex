-- Migration simple : ajouter uniquement l'utilisateur Axel Girard
INSERT INTO public.users (
  user_id,
  workspace_id,
  email,
  first_name,
  last_name,
  company,
  position,
  plan_type,
  subscribed,
  assigned_by,
  created_at,
  updated_at
) VALUES (
  'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7',
  'f9e4f8e3-4b7c-4c8d-8f2a-3d5e6f7g8h9i',
  'axelgirard.pro@gmail.com',
  'Axel',
  'Girard',
  'Axel Enterprise',
  'CEO',
  'premium',
  true,
  'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7',
  now(),
  now()
) ON CONFLICT (user_id, workspace_id) DO NOTHING;