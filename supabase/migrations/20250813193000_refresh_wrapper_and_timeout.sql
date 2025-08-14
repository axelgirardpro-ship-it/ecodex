-- Wrapper pour éviter l'ambiguïté de surcharge sur refresh_projection_for_source
create or replace function public.refresh_projection_for_source_fr(p_source text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.refresh_projection_for_source(p_source := p_source, p_language := 'fr');
  exception when undefined_function then
    -- Fallback si la variante à 2 paramètres n'existe pas
    perform public.refresh_projection_for_source(p_source := p_source);
  end;
end;
$$;

-- Augmenter/neutraliser le statement_timeout pendant le rebuild complet
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
    coalesce(ef.stable_id, ef.id) as object_id,
    ef.id as record_id,
    case when ef.workspace_id is null then 'public' else 'private' end as scope,
    ef.workspace_id,
    fs.access_level,
    (
      select array_agg(ws.workspace_id)
      from public.fe_source_workspace_assignments ws
      where ws.source_name = ef."Source"
    ) as assigned_workspace_ids,
    array['fr']::text[] as languages,

    ef."Nom" as "Nom_fr",
    ef."Description" as "Description_fr",
    ef."Commentaires" as "Commentaires_fr",
    ef."Secteur" as "Secteur_fr",
    ef."Sous-secteur" as "Sous-secteur_fr",
    ef."Périmètre" as "Périmètre_fr",
    ef."Localisation" as "Localisation_fr",
    ef."Unité donnée d'activité" as "Unite_fr",
    nullif(ef."FE", '')::numeric as "FE",
    case when ef."Date" ~ '^\d+$' then ef."Date"::integer else null end as "Date",
    ef."Incertitude" as "Incertitude",
    ef."Source" as "Source"
  from public.emission_factors ef
  join public.fe_sources fs on fs.source_name = ef."Source"
  where ef.is_latest = true;

  raise notice 'ef_all projection rebuilt: % rows', (select count(*) from public.emission_factors_all_search);
end;
$$;


