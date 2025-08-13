-- Refresh projection per source and triggers to keep projection in sync

CREATE OR REPLACE FUNCTION public.refresh_projection_for_source(p_source text, p_language text DEFAULT 'fr')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Supprimer les enregistrements existants pour la source/langue
  DELETE FROM public.emission_factors_public_search_fr
  WHERE "Source" = p_source AND language = p_language;

  -- Réinsérer depuis emission_factors + fe_sources + assignments
  INSERT INTO public.emission_factors_public_search_fr (
    object_id,
    "Nom",
    "Description",
    "FE",
    "Unité donnée d'activité",
    "Périmètre",
    "Secteur",
    "Sous-secteur",
    "Localisation",
    "Date",
    "Incertitude",
    "Commentaires",
    "Source",
    access_level,
    assigned_workspace_ids,
    language
  )
  SELECT
    ef.id as object_id,
    ef."Nom",
    ef."Description",
    ef."FE",
    ef."Unité donnée d'activité",
    ef."Périmètre",
    ef."Secteur",
    ef."Sous-secteur",
    ef."Localisation",
    CASE WHEN ef."Date" ~ '^\d+$' THEN ef."Date"::integer ELSE NULL END as "Date",
    ef."Incertitude",
    ef."Commentaires",
    ef."Source",
    fs.access_level,
    COALESCE(
      (
        SELECT array_agg(DISTINCT fsa.workspace_id)
        FROM public.fe_source_workspace_assignments fsa
        WHERE fsa.source_name = ef."Source"
      ),
      ARRAY[]::uuid[]
    ) as assigned_workspace_ids,
    ef.language
  FROM public.emission_factors ef
  JOIN public.fe_sources fs ON fs.source_name = ef."Source"
  WHERE ef.is_latest = true
    AND ef.workspace_id IS NULL
    AND ef.language = p_language
    AND ef."Source" = p_source;
END;
$$;

-- Trigger helpers
CREATE OR REPLACE FUNCTION public.tr_refresh_projection_fe_sources()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.refresh_projection_for_source(COALESCE(NEW.source_name, OLD.source_name));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tr_refresh_projection_assignments()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.refresh_projection_for_source(COALESCE(NEW.source_name, OLD.source_name));
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.tr_refresh_projection_emission_factors()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_source text;
BEGIN
  v_source := COALESCE(NEW."Source", OLD."Source");
  IF v_source IS NOT NULL THEN
    PERFORM public.refresh_projection_for_source(v_source);
  END IF;
  RETURN NEW;
END; $$;

-- Triggers: fe_sources (access_level / source_name)
DROP TRIGGER IF EXISTS trg_fe_sources_refresh_projection ON public.fe_sources;
CREATE TRIGGER trg_fe_sources_refresh_projection
AFTER INSERT OR UPDATE OF access_level, source_name ON public.fe_sources
FOR EACH ROW EXECUTE FUNCTION public.tr_refresh_projection_fe_sources();

-- Triggers: fe_source_workspace_assignments
DROP TRIGGER IF EXISTS trg_assignments_refresh_projection_ins ON public.fe_source_workspace_assignments;
CREATE TRIGGER trg_assignments_refresh_projection_ins
AFTER INSERT ON public.fe_source_workspace_assignments
FOR EACH ROW EXECUTE FUNCTION public.tr_refresh_projection_assignments();

DROP TRIGGER IF EXISTS trg_assignments_refresh_projection_upd ON public.fe_source_workspace_assignments;
CREATE TRIGGER trg_assignments_refresh_projection_upd
AFTER UPDATE ON public.fe_source_workspace_assignments
FOR EACH ROW EXECUTE FUNCTION public.tr_refresh_projection_assignments();

DROP TRIGGER IF EXISTS trg_assignments_refresh_projection_del ON public.fe_source_workspace_assignments;
CREATE TRIGGER trg_assignments_refresh_projection_del
AFTER DELETE ON public.fe_source_workspace_assignments
FOR EACH ROW EXECUTE FUNCTION public.tr_refresh_projection_assignments();

-- Triggers: emission_factors (si FE modifié)
DROP TRIGGER IF EXISTS trg_ef_refresh_projection ON public.emission_factors;
CREATE TRIGGER trg_ef_refresh_projection
AFTER INSERT OR UPDATE OR DELETE ON public.emission_factors
FOR EACH ROW EXECUTE FUNCTION public.tr_refresh_projection_emission_factors();


