-- Rafraîchissement automatique de la MV teaser lors des rebuilds de ef_all

-- 1) Index unique pour permettre REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_teaser_fr_unique_object
ON public.emission_factors_teaser_public_fr(object_id);

-- 2) Mettre à jour la fonction de refresh pour tenter CONCURRENTLY avec repli
CREATE OR REPLACE FUNCTION public.refresh_emission_factors_teaser_public_fr()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.emission_factors_teaser_public_fr;
  EXCEPTION WHEN others THEN
    -- Repli si l'index unique n'est pas disponible ou en cas de verrouillage
    REFRESH MATERIALIZED VIEW public.emission_factors_teaser_public_fr;
  END;
END;
$$;

-- 3) Déclencheur: après insertion massive (rebuild), rafraîchir la MV une fois
CREATE OR REPLACE FUNCTION public.refresh_teaser_after_ef_all_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.refresh_emission_factors_teaser_public_fr();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS ef_all_after_insert_refresh_teaser ON public.emission_factors_all_search;
CREATE TRIGGER ef_all_after_insert_refresh_teaser
AFTER INSERT ON public.emission_factors_all_search
FOR EACH STATEMENT
EXECUTE FUNCTION public.refresh_teaser_after_ef_all_insert();


