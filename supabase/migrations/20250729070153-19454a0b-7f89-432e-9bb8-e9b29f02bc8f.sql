-- Supprimer TOUTES les policies qui référencent la colonne role dans toutes les tables

-- Policies sur company_invitations
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.company_invitations;
DROP POLICY IF EXISTS "Users can view invitations for their companies" ON public.company_invitations;

-- Policies sur user_roles
DROP POLICY IF EXISTS "Admins can manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view roles in their companies" ON public.user_roles;

-- Policies sur datasets
DROP POLICY IF EXISTS "Users can create datasets in their companies" ON public.datasets;
DROP POLICY IF EXISTS "Users can update datasets in their companies" ON public.datasets;
DROP POLICY IF EXISTS "Users can view datasets in their companies" ON public.datasets;

-- Policies sur companies 
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Owners can update their companies" ON public.companies;
DROP POLICY IF EXISTS "Users can view their own companies" ON public.companies;

-- Créer le type enum pour les rôles
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
    CREATE TYPE user_role_enum AS ENUM ('super_admin', 'admin', 'gestionnaire', 'lecteur');
  END IF;
END $$;

-- Modifier le type de la colonne role
ALTER TABLE public.user_roles ALTER COLUMN role TYPE user_role_enum USING role::user_role_enum;