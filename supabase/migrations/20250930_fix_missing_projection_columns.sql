-- Migration: Ajouter les colonnes manquantes à emission_factors_all_search
-- Date: 2025-09-30
-- Problème: Les colonnes Contributeur, Méthodologie et Type_de_données ne sont pas projetées
-- depuis emission_factors vers emission_factors_all_search

begin;

-- 1. Ajouter les colonnes manquantes à la table emission_factors_all_search
alter table public.emission_factors_all_search
  add column if not exists "Contributeur" text,
  add column if not exists "Méthodologie" text,
  add column if not exists "Type_de_données" text,
  add column if not exists "Contributeur_en" text,
  add column if not exists "Méthodologie_en" text,
  add column if not exists "Type_de_données_en" text;

-- 2. Mettre à jour la fonction rebuild_emission_factors_all_search() pour inclure les nouvelles colonnes
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
    object_id, scope, workspace_id, access_level, assigned_workspace_ids,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "FE","Date","Incertitude","Source","is_blurred","variant",
    "Contributeur","Méthodologie","Type_de_données",
    "Contributeur_en","Méthodologie_en","Type_de_données_en"
  )
  select
    coalesce(ef.id, gen_random_uuid()) as object_id,
    case when ef.workspace_id is null then 'public' else 'private' end as scope,
    ef.workspace_id,
    fs.access_level,
    (
      select array_agg(ws.workspace_id)
      from public.fe_source_workspace_assignments ws
      where ws.source_name = ef."Source"
    ) as assigned_workspace_ids,
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
    ef."Source"             as "Source",
    false                   as "is_blurred",
    'full'                  as "variant",
    ef."Contributeur"       as "Contributeur",
    ef."Méthodologie"       as "Méthodologie",
    ef."Type_de_données"    as "Type_de_données",
    ef."Contributeur_en"    as "Contributeur_en",
    ef."Méthodologie_en"    as "Méthodologie_en",
    ef."Type_de_données_en" as "Type_de_données_en"
  from public.emission_factors ef
  join public.fe_sources fs on fs.source_name = ef."Source"
  where ef.is_latest = true;

  -- Overlays users
  insert into public.emission_factors_all_search (
    object_id, scope, workspace_id, access_level, assigned_workspace_ids,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "FE","Date","Incertitude","Source","is_blurred","variant",
    "Contributeur","Méthodologie","Type_de_données",
    "Contributeur_en","Méthodologie_en","Type_de_données_en"
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
    ufo."Source"             as "Source",
    false                    as "is_blurred",
    'full'                   as "variant",
    ufo."Contributeur"       as "Contributeur",
    ufo."Méthodologie"       as "Méthodologie",
    ufo."Type_de_données"    as "Type_de_données",
    ufo."Contributeur_en"    as "Contributeur_en",
    ufo."Méthodologie_en"    as "Méthodologie_en",
    ufo."Type_de_données_en" as "Type_de_données_en"
  from public.user_factor_overlays ufo
  left join public.fe_sources fs on fs.source_name = ufo."Source";

  raise notice 'ef_all projection (unifiée) rebuilt: % rows', (select count(*) from public.emission_factors_all_search);
end;
$$;

-- 3. Mettre à jour la fonction refresh_ef_all_for_source() pour inclure les nouvelles colonnes
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

  -- Admin (par source)
  insert into public.emission_factors_all_search (
    object_id, scope, workspace_id, access_level, assigned_workspace_ids,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "FE","Date","Incertitude","Source","is_blurred","variant",
    "Contributeur","Méthodologie","Type_de_données",
    "Contributeur_en","Méthodologie_en","Type_de_données_en"
  )
  select
    coalesce(ef.id, gen_random_uuid()) as object_id,
    case when ef.workspace_id is null then 'public' else 'private' end as scope,
    ef.workspace_id,
    fs.access_level,
    (
      select array_agg(ws.workspace_id)
      from public.fe_source_workspace_assignments ws
      where ws.source_name = ef."Source"
    ) as assigned_workspace_ids,
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
    ef."Source"             as "Source",
    false                   as "is_blurred",
    'full'                  as "variant",
    ef."Contributeur"       as "Contributeur",
    ef."Méthodologie"       as "Méthodologie",
    ef."Type_de_données"    as "Type_de_données",
    ef."Contributeur_en"    as "Contributeur_en",
    ef."Méthodologie_en"    as "Méthodologie_en",
    ef."Type_de_données_en" as "Type_de_données_en"
  from public.emission_factors ef
  join public.fe_sources fs on fs.source_name = ef."Source"
  where ef.is_latest = true and ef."Source" = p_source;

  -- Overlays (par source)
  insert into public.emission_factors_all_search (
    object_id, scope, workspace_id, access_level, assigned_workspace_ids,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "FE","Date","Incertitude","Source","is_blurred","variant",
    "Contributeur","Méthodologie","Type_de_données",
    "Contributeur_en","Méthodologie_en","Type_de_données_en"
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
    ufo."Source"             as "Source",
    false                    as "is_blurred",
    'full'                   as "variant",
    ufo."Contributeur"       as "Contributeur",
    ufo."Méthodologie"       as "Méthodologie",
    ufo."Type_de_données"    as "Type_de_données",
    ufo."Contributeur_en"    as "Contributeur_en",
    ufo."Méthodologie_en"    as "Méthodologie_en",
    ufo."Type_de_données_en" as "Type_de_données_en"
  from public.user_factor_overlays ufo
  left join public.fe_sources fs on fs.source_name = ufo."Source"
  where ufo."Source" = p_source;

  raise notice 'ef_all refreshed for source: %', p_source;
end;
$$;

commit;
