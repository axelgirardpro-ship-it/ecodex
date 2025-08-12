-- Migration finale pour l'architecture simplifiée

-- 1. Vérifier et renommer company_id en workspace_id dans user_roles si nécessaire
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'user_roles' AND column_name = 'company_id') THEN
        ALTER TABLE public.user_roles RENAME COLUMN company_id TO workspace_id;
    END IF;
END $$;

-- 2. Maintenant, créer les fonctions avec la bonne colonne
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

-- 3. Fonction is_supra_admin mise à jour selon la colonne qui existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'user_roles' AND column_name = 'workspace_id') THEN
        -- Si workspace_id existe, utiliser workspace_id
        EXECUTE 'CREATE OR REPLACE FUNCTION public.is_supra_admin(user_uuid uuid DEFAULT auth.uid())
        RETURNS boolean
        LANGUAGE sql
        STABLE SECURITY DEFINER
        SET search_path TO ''''
        AS $function$
          SELECT EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = user_uuid AND role = ''supra_admin'' AND workspace_id IS NULL
          );
        $function$';
    ELSE
        -- Sinon, utiliser company_id
        EXECUTE 'CREATE OR REPLACE FUNCTION public.is_supra_admin(user_uuid uuid DEFAULT auth.uid())
        RETURNS boolean
        LANGUAGE sql
        STABLE SECURITY DEFINER
        SET search_path TO ''''
        AS $function$
          SELECT EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = user_uuid AND role = ''supra_admin'' AND company_id IS NULL
          );
        $function$';
    END IF;
END $$;

-- 4. Supprimer les anciennes fonctions
DROP FUNCTION IF EXISTS public.has_company_access(uuid);
DROP FUNCTION IF EXISTS public.is_company_owner(uuid);