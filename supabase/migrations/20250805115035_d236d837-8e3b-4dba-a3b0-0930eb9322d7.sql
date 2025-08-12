-- Add axelgirard.pro+dev@gmail.com as supra admin
INSERT INTO public.user_roles (user_id, role, workspace_id, assigned_by)
SELECT 
  u.id,
  'supra_admin',
  NULL,
  u.id
FROM auth.users u
WHERE u.email = 'axelgirard.pro+dev@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles ur 
  WHERE ur.user_id = u.id AND ur.role = 'supra_admin' AND ur.workspace_id IS NULL
);