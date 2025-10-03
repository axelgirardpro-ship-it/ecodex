-- Migration: VIEW pour fusionner automatiquement les paires FR/EN
-- Date: 2025-09-30
-- Solution: Créer une VIEW qui fusionne les doublons FR/EN à la lecture

begin;

-- Créer une VIEW qui fusionne intelligemment les paires FR/EN
create or replace view v_emission_factors_merged as
select
  coalesce(ef_fr.id, ef_en.id) as id,
  ef_fr.workspace_id,
  ef_fr."Nom",
  ef_fr."Nom_en",
  ef_fr."Description",
  ef_fr."Description_en",
  ef_fr."FE",
  ef_fr."Unité donnée d'activité",
  ef_fr."Unite_en",
  ef_fr."Source",
  ef_fr."Secteur",
  ef_fr."Secteur_en",
  ef_fr."Sous-secteur",
  ef_fr."Sous-secteur_en",
  ef_fr."Localisation",
  ef_fr."Localisation_en",
  ef_fr."Date",
  ef_fr."Incertitude",
  ef_fr."Périmètre",
  ef_fr."Périmètre_en",
  ef_fr."Commentaires",
  ef_fr."Commentaires_en",
  -- Fusion des colonnes FR/EN en priorisant les valeurs non-NULL
  coalesce(ef_fr."Contributeur", ef_en."Contributeur") as "Contributeur",
  coalesce(ef_en."Contributeur_en", ef_fr."Contributeur_en") as "Contributeur_en",
  coalesce(ef_fr."Méthodologie", ef_en."Méthodologie") as "Méthodologie",
  coalesce(ef_en."Méthodologie_en", ef_fr."Méthodologie_en") as "Méthodologie_en",
  coalesce(ef_fr."Type_de_données", ef_en."Type_de_données") as "Type_de_données",
  coalesce(ef_en."Type_de_données_en", ef_fr."Type_de_données_en") as "Type_de_données_en",
  ef_fr.is_latest,
  ef_fr.factor_key,
  ef_fr.version_id,
  ef_fr.valid_from,
  ef_fr.valid_to,
  ef_fr.import_type,
  ef_fr.created_at,
  ef_fr.updated_at
from emission_factors ef_fr
left join emission_factors ef_en on (
  ef_fr.is_latest = true
  and ef_fr."Contributeur" is not null
  and ef_fr."Contributeur_en" is null
  and ef_en.is_latest = true
  and ef_en."Contributeur" is null
  and ef_en."Contributeur_en" is not null
  and ef_fr."Nom" = ef_en."Nom"
  and abs(cast(ef_fr."FE" as numeric) - cast(ef_en."FE" as numeric)) < 0.0001
  and coalesce(ef_fr."Périmètre", '') = coalesce(ef_en."Périmètre", '')
  and ef_fr."Date" = ef_en."Date"
  and ef_fr."Source" = ef_en."Source"
  and coalesce(ef_fr."Localisation", '') = coalesce(ef_en."Localisation", '')
)
where ef_fr.is_latest = true
  and (ef_fr."Contributeur" is not null or ef_fr."Contributeur_en" is not null);

-- Créer un commentaire sur la VIEW
comment on view v_emission_factors_merged is 
'View qui fusionne automatiquement les doublons FR/EN de emission_factors. 
Utilise un LEFT JOIN pour combiner les records ayant les mêmes caractéristiques 
mais des colonnes FR/EN réparties sur des lignes différentes.';

-- Mettre à jour la fonction de rebuild pour utiliser la VIEW
create or replace function public.rebuild_emission_factors_all_search()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('statement_timeout', '0', true);

  truncate table public.emission_factors_all_search;

  -- Admin (base commune) depuis la VIEW fusionnée
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
  from public.v_emission_factors_merged ef
  join public.fe_sources fs on fs.source_name = ef."Source"
  where ef.is_latest = true;

  -- Overlays users (inchangé)
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

  raise notice 'ef_all projection (unifiée avec fusion FR/EN) rebuilt: % rows', (select count(*) from public.emission_factors_all_search);
end;
$$;

commit;



