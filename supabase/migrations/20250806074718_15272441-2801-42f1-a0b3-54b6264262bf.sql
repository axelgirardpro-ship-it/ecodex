-- Add supra admin role for user 5c4628da-d45c-42f2-84f4-c9066323cf91
INSERT INTO public.user_roles (user_id, role, workspace_id, assigned_by)
VALUES ('5c4628da-d45c-42f2-84f4-c9066323cf91', 'supra_admin', NULL, auth.uid())
ON CONFLICT (user_id, role, COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid)) DO NOTHING;