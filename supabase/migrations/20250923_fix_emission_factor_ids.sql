-- Stabilise les IDs des facteurs d'émission et simplifie la projection Algolia
begin;

-- 1) Backfill des IDs manquants ou invalides dans emission_factors
with updated as (
  update public.emission_factors ef
  set id = gen_random_uuid()
  where ef.id is null
     or ef.id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  returning 1
)
select count(*) as backfilled from updated;

-- 2) Rétablir la colonne id comme clé primaire UUID
alter table public.emission_factors
  drop constraint if exists emission_factors_pkey;

alter table public.emission_factors
  alter column id type uuid using id::uuid,
  alter column id set default gen_random_uuid(),
  alter column id set not null;

alter table public.emission_factors
  add constraint emission_factors_pkey primary key (id);

-- 3) Recréer la projection emission_factors_all_search sans colonne record_id
create or replace function public.rebuild_emission_factors_all_search()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('statement_timeout', '0', true);

  truncate table public.emission_factors_all_search;

  -- Base commune admin
  insert into public.emission_factors_all_search (
    object_id, scope, workspace_id, access_level, assigned_workspace_ids, languages,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "FE","Date","Incertitude","Source"
  )
  select
    ef.id::uuid as object_id,
    case when ef.workspace_id~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then 'private' else 'public' end as scope,
    case when ef.workspace_id~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then ef.workspace_id::uuid else null end as workspace_id,
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
  where ef.is_latest = true;

  -- Overlays utilisateurs
  insert into public.emission_factors_all_search (
    object_id, scope, workspace_id, access_level, assigned_workspace_ids, languages,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "FE","Date","Incertitude","Source"
  )
  select
    ufo.overlay_id as object_id,
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

  raise notice 'emission_factors_all_search rebuilt: % rows', (select count(*) from public.emission_factors_all_search);
end;
$$;

create or replace function public.refresh_ef_all_for_source(p_source text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_source is null or length(p_source) = 0 then
    raise exception 'refresh_ef_all_for_source: source vide';
  end if;

  perform set_config('statement_timeout', '0', true);

  delete from public.emission_factors_all_search where "Source" = p_source;

  insert into public.emission_factors_all_search (
    object_id, scope, workspace_id, access_level, assigned_workspace_ids, languages,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "FE","Date","Incertitude","Source"
  )
  select
    ef.id::uuid as object_id,
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

  insert into public.emission_factors_all_search (
    object_id, scope, workspace_id, access_level, assigned_workspace_ids, languages,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "FE","Date","Incertitude","Source"
  )
  select
    ufo.overlay_id as object_id,
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

  raise notice 'emission_factors_all_search refreshed for source: %', p_source;
end;
$$;

-- 4) Supprimer la colonne record_id (devenue inutile)
alter table public.emission_factors_all_search
  drop column if exists record_id;

commit;

