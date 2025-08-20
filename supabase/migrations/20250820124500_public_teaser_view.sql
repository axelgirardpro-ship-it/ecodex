-- Vue publique "teaser" sûre basée sur emission_factors_all_search
-- Expose uniquement des champs non sensibles et floute systématiquement le premium

DROP VIEW IF EXISTS public.emission_factors_teaser_public_fr;

CREATE MATERIALIZED VIEW IF NOT EXISTS public.emission_factors_teaser_public_fr AS
SELECT
  ef.object_id,
  'fr'::text AS language,
  ef.scope,
  ef.access_level,
  ef."Source",
  ef."Date",
  ef."Nom_fr"           AS "Nom",
  ef."Secteur_fr"       AS "Secteur",
  ef."Sous-secteur_fr"  AS "Sous-secteur",
  ef."Localisation_fr"  AS "Localisation",
  ef."Périmètre_fr"     AS "Périmètre",
  CASE WHEN ef.access_level = 'premium' THEN NULL ELSE ef."Description_fr" END AS "Description",
  CASE WHEN ef.access_level = 'premium' THEN NULL ELSE ef."FE" END AS "FE",
  CASE WHEN ef.access_level = 'premium' THEN NULL ELSE ef."Unite_fr" END AS "Unité donnée d'activité",
  CASE WHEN ef.access_level = 'premium' THEN NULL ELSE ef."Commentaires_fr" END AS "Commentaires",
  (ef.access_level = 'premium') AS is_blurred
FROM public.emission_factors_all_search ef
WHERE ef.scope = 'public';

-- Droits: lecture publique (teaser) + lecture pour authenticated
REVOKE ALL ON TABLE public.emission_factors_teaser_public_fr FROM PUBLIC;
GRANT SELECT ON TABLE public.emission_factors_teaser_public_fr TO anon;
GRANT SELECT ON TABLE public.emission_factors_teaser_public_fr TO authenticated;

CREATE INDEX IF NOT EXISTS idx_teaser_fr_source ON public.emission_factors_teaser_public_fr ("Source");
CREATE INDEX IF NOT EXISTS idx_teaser_fr_nom ON public.emission_factors_teaser_public_fr ("Nom");

COMMENT ON MATERIALIZED VIEW public.emission_factors_teaser_public_fr IS 'Vue matérialisée publique teaser: premium flouté, standard visible';

CREATE OR REPLACE FUNCTION public.refresh_emission_factors_teaser_public_fr()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('statement_timeout', '0', true);
  REFRESH MATERIALIZED VIEW public.emission_factors_teaser_public_fr;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_emission_factors_teaser_public_fr() TO authenticated;

