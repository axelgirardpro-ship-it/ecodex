-- Migration pour simplifier l'architecture - Partie 3: Nettoyage des contraintes et fonctions

-- 1. Supprimer les contraintes de clés étrangères qui pointent vers companies
DO $$
BEGIN
    -- Supprimer les contraintes de clés étrangères existantes
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'user_roles_company_id_fkey') THEN
        ALTER TABLE public.user_roles DROP CONSTRAINT user_roles_company_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'datasets_company_id_fkey') THEN
        ALTER TABLE public.datasets DROP CONSTRAINT datasets_company_id_fkey;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'company_invitations_company_id_fkey') THEN
        ALTER TABLE public.workspace_invitations DROP CONSTRAINT company_invitations_company_id_fkey;
    END IF;
END $$;

-- 2. Supprimer les politiques RLS qui dépendent de companies
DO $$
BEGIN
    -- Supprimer les politiques sur workspace_invitations qui référencent companies
    DROP POLICY IF EXISTS "Users can view invitations for their companies" ON public.workspace_invitations;
    DROP POLICY IF EXISTS "Admins can manage invitations" ON public.workspace_invitations;
END $$;

-- 3. Supprimer la table companies maintenant que les dépendances sont supprimées
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'companies') THEN
        DROP TABLE public.companies CASCADE;
    END IF;
END $$;

-- 4. Créer les nouvelles fonctions pour l'architecture simplifiée

-- Fonction has_workspace_access
CREATE OR REPLACE FUNCTION public.has_workspace_access(workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND workspace_id = $1
  );
END;
$function$;

-- Fonction is_workspace_owner
CREATE OR REPLACE FUNCTION public.is_workspace_owner(workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.workspaces 
    WHERE id = workspace_id AND owner_id = auth.uid()
  );
END;
$function$;

-- Fonction is_supra_admin mise à jour
CREATE OR REPLACE FUNCTION public.is_supra_admin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = user_uuid AND role = 'supra_admin' AND workspace_id IS NULL
  );
$function$;

-- 5. Supprimer les anciennes fonctions qui ne sont plus nécessaires
DROP FUNCTION IF EXISTS public.has_company_access(uuid);
DROP FUNCTION IF EXISTS public.is_company_owner(uuid);