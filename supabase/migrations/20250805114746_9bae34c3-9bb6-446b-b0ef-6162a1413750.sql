-- Créer les types ENUM pour les dropdowns
CREATE TYPE public.user_role_type AS ENUM ('admin', 'gestionnaire', 'lecteur', 'supra_admin');
CREATE TYPE public.plan_type AS ENUM ('freemium', 'standard', 'premium');
CREATE TYPE public.import_status_type AS ENUM ('processing', 'completed', 'failed');
CREATE TYPE public.dataset_status_type AS ENUM ('active', 'inactive');
CREATE TYPE public.invitation_status_type AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE public.favorite_item_type AS ENUM ('emission_factor', 'search', 'dataset');
CREATE TYPE public.audit_action_type AS ENUM ('user_signup', 'user_login', 'user_logout', 'user_signup_error', 'data_import', 'data_export', 'role_assigned', 'workspace_created', 'invitation_sent', 'invitation_accepted');

-- Modifier les colonnes pour utiliser les ENUMs (en préservant les données existantes)
-- user_roles.role
ALTER TABLE public.user_roles 
ALTER COLUMN role TYPE public.user_role_type 
USING role::public.user_role_type;

-- workspaces.plan_type
ALTER TABLE public.workspaces 
ALTER COLUMN plan_type TYPE public.plan_type 
USING plan_type::public.plan_type;

-- search_quotas.plan_type
ALTER TABLE public.search_quotas 
ALTER COLUMN plan_type TYPE public.plan_type 
USING plan_type::public.plan_type;

-- users.plan_type
ALTER TABLE public.users 
ALTER COLUMN plan_type TYPE public.plan_type 
USING plan_type::public.plan_type;

-- data_imports.status
ALTER TABLE public.data_imports 
ALTER COLUMN status TYPE public.import_status_type 
USING status::public.import_status_type;

-- datasets.status
ALTER TABLE public.datasets 
ALTER COLUMN status TYPE public.dataset_status_type 
USING status::public.dataset_status_type;

-- workspace_invitations.status
ALTER TABLE public.workspace_invitations 
ALTER COLUMN status TYPE public.invitation_status_type 
USING status::public.invitation_status_type;

-- workspace_invitations.role
ALTER TABLE public.workspace_invitations 
ALTER COLUMN role TYPE public.user_role_type 
USING role::public.user_role_type;

-- favorites.item_type
ALTER TABLE public.favorites 
ALTER COLUMN item_type TYPE public.favorite_item_type 
USING item_type::public.favorite_item_type;

-- audit_logs.action
ALTER TABLE public.audit_logs 
ALTER COLUMN action TYPE public.audit_action_type 
USING action::public.audit_action_type;

-- Ajouter axelgirard.pro+dev@gmail.com en supra admin
DO $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Trouver l'user_id à partir de l'email
    SELECT id INTO target_user_id 
    FROM auth.users 
    WHERE email = 'axelgirard.pro+dev@gmail.com';
    
    IF target_user_id IS NOT NULL THEN
        -- Ajouter le rôle supra_admin (sans workspace_id)
        INSERT INTO public.user_roles (user_id, workspace_id, role, assigned_by)
        VALUES (target_user_id, NULL, 'supra_admin', target_user_id)
        ON CONFLICT (user_id, COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid), role) DO NOTHING;
        
        -- Log l'action
        INSERT INTO public.audit_logs (user_id, action, details)
        VALUES (
            target_user_id,
            'role_assigned',
            jsonb_build_object(
                'role', 'supra_admin',
                'assigned_by_system', true,
                'email', 'axelgirard.pro+dev@gmail.com'
            )
        );
    END IF;
END $$;