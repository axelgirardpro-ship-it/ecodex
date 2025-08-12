-- Correction de la fonction workspace_has_access pour fixer l'avertissement de sécurité
CREATE OR REPLACE FUNCTION public.workspace_has_access(workspace_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE 
    WHEN w.plan_type = 'freemium' THEN 
      COALESCE(wt.expires_at > now(), false)
    ELSE 
      true
  END
  FROM public.workspaces w
  LEFT JOIN public.workspace_trials wt ON wt.workspace_id = w.id
  WHERE w.id = workspace_uuid;
$function$;