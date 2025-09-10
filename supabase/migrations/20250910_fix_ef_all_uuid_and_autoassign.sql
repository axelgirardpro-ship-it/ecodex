begin;

-- 1) Harden rebuild function with explicit uuid casting and unified overlays
create or replace function public.rebuild_emission_factors_all_search()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('statement_timeout', '0', true);

  truncate table public.emission_factors_all_search;

  -- Admin (base commune) depuis public.emission_factors
  insert into public.emission_factors_all_search (
    object_id, record_id, scope, workspace_id, access_level, assigned_workspace_ids, languages,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "FE","Date","Incertitude","Source"
  )
  select
    case when ef.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then ef.id::uuid else gen_random_uuid() end as object_id,
    case when ef.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then ef.id::uuid else gen_random_uuid() end as record_id,
    case when ef.workspace_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then 'private' else 'public' end as scope,
    case when ef.workspace_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then ef.workspace_id::uuid else null end as workspace_id,
    fs.access_level,
    (
      select array_agg(ws.workspace_id)
      from public.fe_source_workspace_assignments ws
      where ws.source_name = ef."Source"
    ) as assigned_workspace_ids,
    array_remove(array[
      case when (ef."Nom" is not null or ef."Description" is not null or ef."Unité donnée d'activité" is not null or ef."Secteur" is not null or ef."Localisation" is not null) then 'fr' end,
      case when (ef."Nom_en" is not null or ef."Description_en" is not null or ef."Unite_en" is not null or ef."Secteur_en" is not null or ef."Localisation_en" is not null) then 'en' end
    ], null)::text[] as languages,
    ef."Nom"                as "Nom_fr",
    ef."Description"        as "Description_fr",
    ef."Commentaires"       as "Commentaires_fr",
    ef."Secteur"            as "Secteur_fr",
    ef."Sous-secteur"       as "Sous-secteur_fr",
    ef."Périmètre"          as "Périmètre_fr",
    ef."Localisation"       as "Localisation_fr",
    ef."Unité donnée d'activité" as "Unite_fr",
    public.safe_to_numeric(coalesce(nullif(ef."FE"::text, ''), null)) as "FE",
    case when trim(coalesce(ef."Date"::text,'')) ~ '^\d+$' then ef."Date"::integer else null end as "Date",
    ef."Incertitude"        as "Incertitude",
    ef."Source"             as "Source"
  from public.emission_factors ef
  join public.fe_sources fs on fs.source_name = ef."Source"
  where ef.is_latest = true;

  -- Overlays users
  insert into public.emission_factors_all_search (
    object_id, record_id, scope, workspace_id, access_level, assigned_workspace_ids, languages,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "FE","Date","Incertitude","Source"
  )
  select
    ufo.overlay_id as object_id,
    ufo.overlay_id as record_id,
    'private' as scope,
    ufo.workspace_id,
    coalesce(fs.access_level, 'standard') as access_level,
    (
      select array_agg(ws.workspace_id)
      from public.fe_source_workspace_assignments ws
      where ws.source_name = ufo."Source"
    ) as assigned_workspace_ids,
    array_remove(array[
      case when (ufo."Nom" is not null or ufo."Description" is not null or ufo."Unité donnée d'activité" is not null or ufo."Secteur" is not null or ufo."Localisation" is not null) then 'fr' end,
      case when (ufo."Nom_en" is not null or ufo."Description_en" is not null or ufo."Unite_en" is not null or ufo."Secteur_en" is not null or ufo."Localisation_en" is not null) then 'en' end
    ], null)::text[] as languages,
    ufo."Nom"                as "Nom_fr",
    ufo."Description"        as "Description_fr",
    ufo."Commentaires"       as "Commentaires_fr",
    ufo."Secteur"            as "Secteur_fr",
    ufo."Sous-secteur"       as "Sous-secteur_fr",
    ufo."Périmètre"          as "Périmètre_fr",
    ufo."Localisation"       as "Localisation_fr",
    ufo."Unité donnée d'activité" as "Unite_fr",
    ufo."Nom_en"             as "Nom_en",
    ufo."Description_en"     as "Description_en",
    ufo."Commentaires_en"    as "Commentaires_en",
    ufo."Secteur_en"         as "Secteur_en",
    ufo."Sous-secteur_en"    as "Sous-secteur_en",
    ufo."Périmètre_en"       as "Périmètre_en",
    ufo."Localisation_en"    as "Localisation_en",
    ufo."Unite_en"           as "Unite_en",
    public.safe_to_numeric(coalesce(nullif(ufo."FE", ''), null)) as "FE",
    case when trim(coalesce(ufo."Date",'')) ~ '^\d+$' then trim(ufo."Date")::integer else null end as "Date",
    ufo."Incertitude"        as "Incertitude",
    ufo."Source"             as "Source"
  from public.user_factor_overlays ufo
  left join public.fe_sources fs on fs.source_name = ufo."Source";

  raise notice 'ef_all projection (unifiée) rebuilt: % rows', (select count(*) from public.emission_factors_all_search);
end;
$$;

-- 2) Harden refresh per source with explicit uuid casting and overlays
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

  perform set_config('statement_timeout', '0', true);

  delete from public.emission_factors_all_search where "Source" = p_source;

  -- Admin (par source)
  insert into public.emission_factors_all_search (
    object_id, record_id, scope, workspace_id, access_level, assigned_workspace_ids, languages,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "FE","Date","Incertitude","Source"
  )
  select
    case when ef.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then ef.id::uuid else gen_random_uuid() end as object_id,
    case when ef.id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then ef.id::uuid else gen_random_uuid() end as record_id,
    case when ef.workspace_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then 'private' else 'public' end as scope,
    case when ef.workspace_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then ef.workspace_id::uuid else null end as workspace_id,
    fs.access_level,
    (
      select array_agg(ws.workspace_id)
      from public.fe_source_workspace_assignments ws
      where ws.source_name = ef."Source"
    ) as assigned_workspace_ids,
    array_remove(array[
      case when (ef."Nom" is not null or ef."Description" is not null or ef."Unité donnée d'activité" is not null or ef."Secteur" is not null or ef."Localisation" is not null) then 'fr' end,
      case when (ef."Nom_en" is not null or ef."Description_en" is not null or ef."Unite_en" is not null or ef."Secteur_en" is not null or ef."Localisation_en" is not null) then 'en' end
    ], null)::text[] as languages,
    ef."Nom"                as "Nom_fr",
    ef."Description"        as "Description_fr",
    ef."Commentaires"       as "Commentaires_fr",
    ef."Secteur"            as "Secteur_fr",
    ef."Sous-secteur"       as "Sous-secteur_fr",
    ef."Périmètre"          as "Périmètre_fr",
    ef."Localisation"       as "Localisation_fr",
    ef."Unité donnée d'activité" as "Unite_fr",
    ef."Nom_en"             as "Nom_en",
    ef."Description_en"     as "Description_en",
    ef."Commentaires_en"    as "Commentaires_en",
    ef."Secteur_en"         as "Secteur_en",
    ef."Sous-secteur_en"    as "Sous-secteur_en",
    ef."Périmètre_en"       as "Périmètre_en",
    ef."Localisation_en"    as "Localisation_en",
    ef."Unite_en"           as "Unite_en",
    public.safe_to_numeric(coalesce(nullif(ef."FE"::text, ''), null)) as "FE",
    case when trim(coalesce(ef."Date"::text,'')) ~ '^\d+$' then ef."Date"::integer else null end as "Date",
    ef."Incertitude"        as "Incertitude",
    ef."Source"             as "Source"
  from public.emission_factors ef
  join public.fe_sources fs on fs.source_name = ef."Source"
  where ef.is_latest = true and ef."Source" = p_source;

  -- Overlays (par source)
  insert into public.emission_factors_all_search (
    object_id, record_id, scope, workspace_id, access_level, assigned_workspace_ids, languages,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "FE","Date","Incertitude","Source"
  )
  select
    ufo.overlay_id as object_id,
    ufo.overlay_id as record_id,
    'private' as scope,
    ufo.workspace_id,
    coalesce(fs.access_level, 'standard') as access_level,
    (
      select array_agg(ws.workspace_id)
      from public.fe_source_workspace_assignments ws
      where ws.source_name = ufo."Source"
    ) as assigned_workspace_ids,
    array_remove(array[
      case when (ufo."Nom" is not null or ufo."Description" is not null or ufo."Unité donnée d'activité" is not null or ufo."Secteur" is not null or ufo."Localisation" is not null) then 'fr' end,
      case when (ufo."Nom_en" is not null or ufo."Description_en" is not null or ufo."Unite_en" is not null or ufo."Secteur_en" is not null or ufo."Localisation_en" is not null) then 'en' end
    ], null)::text[] as languages,
    ufo."Nom"                as "Nom_fr",
    ufo."Description"        as "Description_fr",
    ufo."Commentaires"       as "Commentaires_fr",
    ufo."Secteur"            as "Secteur_fr",
    ufo."Sous-secteur"       as "Sous-secteur_fr",
    ufo."Périmètre"          as "Périmètre_fr",
    ufo."Localisation"       as "Localisation_fr",
    ufo."Unité donnée d'activité" as "Unite_fr",
    ufo."Nom_en"             as "Nom_en",
    ufo."Description_en"     as "Description_en",
    ufo."Commentaires_en"    as "Commentaires_en",
    ufo."Secteur_en"         as "Secteur_en",
    ufo."Sous-secteur_en"    as "Sous-secteur_en",
    ufo."Périmètre_en"       as "Périmètre_en",
    ufo."Localisation_en"    as "Localisation_en",
    ufo."Unite_en"           as "Unite_en",
    public.safe_to_numeric(coalesce(nullif(ufo."FE", ''), null)) as "FE",
    case when trim(coalesce(ufo."Date",'')) ~ '^\d+$' then trim(ufo."Date")::integer else null end as "Date",
    ufo."Incertitude"        as "Incertitude",
    ufo."Source"             as "Source"
  from public.user_factor_overlays ufo
  left join public.fe_sources fs on fs.source_name = ufo."Source"
  where ufo."Source" = p_source;

  raise notice 'ef_all refreshed for source: %', p_source;
end;
$$;

-- 3) Ensure auto-assign trigger fires on is_global updates too
drop trigger if exists trg_auto_assign_fe_sources on public.fe_sources;
create trigger trg_auto_assign_fe_sources
  after insert or update of access_level, is_global on public.fe_sources
  for each row execute function public.auto_assign_sources_on_fe_sources();

commit;
