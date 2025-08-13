-- Fonction dédiée, non surchargée, pour rafraîchir ef_all par source
create or replace function public.refresh_ef_all_for_source(p_source text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_source is null or length(p_source) = 0 then
    raise notice 'refresh_ef_all_for_source: source vide';
    return;
  end if;

  delete from public.emission_factors_all_search where "Source" = p_source;

  insert into public.emission_factors_all_search (
    object_id, record_id, scope, workspace_id, access_level, assigned_workspace_ids, languages,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "FE","Date","Incertitude","Source"
  )
  select
    coalesce(ef.stable_id, ef.id) as object_id,
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
    null::text as "Nom_en",
    null::text as "Description_en",
    null::text as "Commentaires_en",
    null::text as "Secteur_en",
    null::text as "Sous-secteur_en",
    null::text as "Périmètre_en",
    null::text as "Localisation_en",
    null::text as "Unite_en",
    nullif(ef."FE", '')::numeric as "FE",
    case when ef."Date" ~ '^\d+$' then ef."Date"::integer else null end as "Date",
    ef."Incertitude" as "Incertitude",
    ef."Source" as "Source"
  from public.emission_factors ef
  join public.fe_sources fs on fs.source_name = ef."Source"
  where ef.is_latest = true and ef."Source" = p_source;

  raise notice 'ef_all refresh pour source %', p_source;
end
$$;
