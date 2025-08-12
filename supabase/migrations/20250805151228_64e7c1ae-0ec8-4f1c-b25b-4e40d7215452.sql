-- Restore supra_admin role for the user
INSERT INTO user_roles (user_id, role, workspace_id, assigned_by, original_role) 
VALUES (
  'e6e2e278-14e9-44fd-86ff-28da775f43c6', 
  'supra_admin', 
  NULL, 
  'e6e2e278-14e9-44fd-86ff-28da775f43c6',
  'supra_admin'
) 
ON CONFLICT (user_id, COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid), role) 
DO UPDATE SET 
  role = 'supra_admin',
  original_role = 'supra_admin',
  updated_at = now();