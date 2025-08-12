-- Ajouter la contrainte unique sur (user_id, workspace_id)
ALTER TABLE public.users 
ADD CONSTRAINT users_user_id_workspace_id_unique 
UNIQUE (user_id, workspace_id);

-- Insérer uniquement l'utilisateur Axel Girard
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
  '11111111-1111-1111-1111-111111111111',
  'axelgirard.pro@gmail.com',
  'Axel',
  'Girard',
  'Axel Workspace',
  'CEO',
  'premium',
  true,
  'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7',
  now(),
  now()
);