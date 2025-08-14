-- Mettre à jour les fonctions de triggers pour utiliser ef_all et la fonction dédiée
create or replace function public.tr_refresh_projection_fe_sources()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_ef_all_for_source(coalesce(new.source_name, old.source_name));
  return new;
end; $$;

create or replace function public.tr_refresh_projection_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_ef_all_for_source(coalesce(new.source_name, old.source_name));
  return new;
end; $$;

create or replace function public.tr_refresh_projection_emission_factors()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text;
begin
  v_source := coalesce(new."Source", old."Source");
  if v_source is not null then
    perform public.refresh_ef_all_for_source(v_source);
  end if;
  return new;
end; $$;

-- Recréer les triggers pour pointer vers ces fonctions
DROP TRIGGER IF EXISTS trg_fe_sources_refresh_projection ON public.fe_sources;
CREATE TRIGGER trg_fe_sources_refresh_projection
AFTER INSERT OR UPDATE OF access_level, source_name ON public.fe_sources
FOR EACH ROW EXECUTE FUNCTION public.tr_refresh_projection_fe_sources();

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

DROP TRIGGER IF EXISTS trg_ef_refresh_projection ON public.emission_factors;
CREATE TRIGGER trg_ef_refresh_projection
AFTER INSERT OR UPDATE OR DELETE ON public.emission_factors
FOR EACH ROW EXECUTE FUNCTION public.tr_refresh_projection_emission_factors();
