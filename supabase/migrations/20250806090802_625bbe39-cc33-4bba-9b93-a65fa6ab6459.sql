-- Nettoyer les anciens éléments obsolètes du système

-- 1. Supprimer les anciennes tables migrées
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.subscribers CASCADE;

-- 2. Supprimer les fonctions obsolètes
DROP FUNCTION IF EXISTS public.migrate_to_unified_users();
DROP FUNCTION IF EXISTS public.is_original_supra_admin(uuid);

-- 3. Nettoyer la colonne original_role qui n'est plus utilisée
ALTER TABLE public.user_roles DROP COLUMN IF EXISTS original_role;

-- 4. Mettre à jour les fonctions qui utilisaient les anciennes tables
-- La fonction get_user_workspace_plan doit être simplifiée
CREATE OR REPLACE FUNCTION public.get_user_workspace_plan(user_uuid uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Récupérer le plan depuis la table users directement
  SELECT COALESCE(u.plan_type, w.plan_type, 'freemium')
  FROM public.users u
  LEFT JOIN public.workspaces w ON w.id = u.workspace_id
  WHERE u.user_id = user_uuid
  LIMIT 1;
$function$;

-- 5. Simplifier has_company_access pour utiliser la nouvelle structure
CREATE OR REPLACE FUNCTION public.has_company_access(company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid() AND u.workspace_id = company_id
  );
$function$;

-- 6. Simplifier has_workspace_access pour utiliser la nouvelle structure  
CREATE OR REPLACE FUNCTION public.has_workspace_access(workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.user_id = auth.uid() AND u.workspace_id = workspace_id
  );
$function$;

-- 7. Mettre à jour get_current_user_role pour utiliser users + user_roles
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT ur.role
  FROM public.user_roles ur
  JOIN public.users u ON ur.user_id = u.user_id AND ur.workspace_id = u.workspace_id
  WHERE u.user_id = auth.uid()
  LIMIT 1;
$function$;