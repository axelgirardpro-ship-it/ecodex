-- Ajoute un cast sûr pour Date et corrige la fonction de rebuild
create or replace function public.safe_to_int(v text)
returns integer
language plpgsql
as $$
declare n integer; begin
  if v is null or btrim(v) = '' then return null; end if;
  begin
    n := v::integer; return n;
  exception when invalid_text_representation then
    return null;
  end;
end; $$;

create or replace function public.rebuild_emission_factors_all_search()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('statement_timeout', '0', true);
  truncate table public.emission_factors_all_search;
  insert into public.emission_factors_all_search (
    object_id, record_id, scope, workspace_id, access_level, assigned_workspace_ids, languages,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "FE","Date","Incertitude","Source"
  )
  select
    ef.id as object_id,
    ef.id as record_id,
    case when ef.workspace_id is null then 'public' else 'private' end as scope,
    ef.workspace_id,
    fs.access_level,
    (select array_agg(ws.workspace_id) from public.fe_source_workspace_assignments ws where ws.source_name = ef."Source") as assigned_workspace_ids,
    array['fr']::text[] as languages,
    ef."Nom" as "Nom_fr",
    ef."Description" as "Description_fr",
    ef."Commentaires" as "Commentaires_fr",
    ef."Secteur" as "Secteur_fr",
    ef."Sous-secteur" as "Sous-secteur_fr",
    ef."Périmètre" as "Périmètre_fr",
    ef."Localisation" as "Localisation_fr",
    ef."Unité donnée d'activité" as "Unite_fr",
    public.safe_to_numeric(coalesce(ef."FE"::text, null)) as "FE",
    public.safe_to_int(coalesce(ef."Date"::text, null)) as "Date",
    ef."Incertitude" as "Incertitude",
    ef."Source" as "Source"
  from public.emission_factors ef
  join public.fe_sources fs on fs.source_name = ef."Source"
  where ef.is_latest = true;
end; $$;


