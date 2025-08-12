-- Restore supra_admin role for the user
INSERT INTO user_roles (user_id, role, workspace_id, assigned_by, original_role) 
VALUES (
  'e6e2e278-14e9-44fd-86ff-28da775f43c6', 
  'supra_admin', 
  NULL, 
  'e6e2e278-14e9-44fd-86ff-28da775f43c6',
  'supra_admin'
);