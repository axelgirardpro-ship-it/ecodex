-- Fix sécurité: activer security_invoker sur la vue et pinner le search_path des fonctions
-- Contexte: Lints 0010_security_definer_view (ERROR) et 0011_function_search_path_mutable (WARN)

BEGIN;

-- 1) Vue: faire respecter les RLS via security_invoker
ALTER VIEW public.v_unified_search_stats
  SET (security_invoker = true);

-- 2) Fonction: sync_workspace_user_quotas — pinner le search_path et qualifier les références
CREATE OR REPLACE FUNCTION public.sync_workspace_user_quotas(target_workspace_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    user_record RECORD;
    updated_count INTEGER := 0;
BEGIN
    -- Utiliser public.user_roles et auth.users explicitement
    FOR user_record IN 
        SELECT ur.user_id 
        FROM public.user_roles ur
        JOIN auth.users au ON ur.user_id = au.id  -- Uniquement utilisateurs valides
        WHERE ur.workspace_id = target_workspace_id
    LOOP
        PERFORM public.update_user_quotas_from_workspace(user_record.user_id);
        updated_count := updated_count + 1;
    END LOOP;

    RETURN updated_count;
END;
$$;

-- 3) Fonction placeholder: refresh_emission_factors_teaser_public_fr — pinner le search_path si elle existe
DO $block$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'refresh_emission_factors_teaser_public_fr'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.refresh_emission_factors_teaser_public_fr()
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = ''
      AS $body$
      BEGIN
        -- Fonction temporaire pour compatibilité; pas d'effet
        RETURN;
      END;
      $body$;
    $fn$;
  END IF;
END
$block$;

COMMIT;


