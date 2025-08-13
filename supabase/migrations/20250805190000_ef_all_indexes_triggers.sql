-- Indexes pour l'index unifié ef_all
create index if not exists ef_all_scope_idx on public.emission_factors_all_search (scope);
create index if not exists ef_all_source_idx on public.emission_factors_all_search ("Source");
create index if not exists ef_all_workspace_idx on public.emission_factors_all_search (workspace_id);
create index if not exists ef_all_languages_gin on public.emission_factors_all_search using gin (languages);

-- Rafraîchissement ciblé par source
create or replace function public.refresh_projection_for_source(p_source text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_source is null or length(p_source) = 0 then
    raise notice 'refresh_projection_for_source: source vide';
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
    -- Champs FR
    ef."Nom" as "Nom_fr",
    ef."Description" as "Description_fr",
    ef."Commentaires" as "Commentaires_fr",
    ef."Secteur" as "Secteur_fr",
    ef."Sous-secteur" as "Sous-secteur_fr",
    ef."Périmètre" as "Périmètre_fr",
    ef."Localisation" as "Localisation_fr",
    ef."Unité donnée d'activité" as "Unite_fr",
    -- Champs EN (placeholder)
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

  raise notice 'projection ef_all refresh pour source %', p_source;
end
$$;

-- Triggers: emission_factors
drop trigger if exists trg_ef_refresh_projection_ins on public.emission_factors;
drop trigger if exists trg_ef_refresh_projection_upd on public.emission_factors;
drop trigger if exists trg_ef_refresh_projection_del on public.emission_factors;

create or replace function public.trg_ef_after_change_refresh()
returns trigger language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT') then
    perform public.refresh_projection_for_source(new."Source");
  elsif (tg_op = 'UPDATE') then
    if new."Source" is distinct from old."Source" then
      perform public.refresh_projection_for_source(old."Source");
    end if;
    perform public.refresh_projection_for_source(new."Source");
  elsif (tg_op = 'DELETE') then
    perform public.refresh_projection_for_source(old."Source");
  end if;
  return null;
end $$;

create trigger trg_ef_refresh_projection_ins
after insert on public.emission_factors
for each row execute function public.trg_ef_after_change_refresh();

create trigger trg_ef_refresh_projection_upd
after update on public.emission_factors
for each row execute function public.trg_ef_after_change_refresh();

create trigger trg_ef_refresh_projection_del
after delete on public.emission_factors
for each row execute function public.trg_ef_after_change_refresh();

-- Triggers: fe_sources
drop trigger if exists trg_fs_refresh_projection_upd on public.fe_sources;
create or replace function public.trg_fs_after_change_refresh()
returns trigger language plpgsql security definer as $$
begin
  if (tg_op = 'UPDATE') then
    if new.source_name is distinct from old.source_name then
      perform public.refresh_projection_for_source(old.source_name);
    end if;
    perform public.refresh_projection_for_source(new.source_name);
  elsif (tg_op = 'INSERT') then
    perform public.refresh_projection_for_source(new.source_name);
  end if;
  return null;
end $$;

create trigger trg_fs_refresh_projection_upd
after insert or update on public.fe_sources
for each row execute function public.trg_fs_after_change_refresh();

-- Triggers: fe_source_workspace_assignments
drop trigger if exists trg_fsw_refresh_projection_iud on public.fe_source_workspace_assignments;
create or replace function public.trg_fsw_after_change_refresh()
returns trigger language plpgsql security definer as $$
begin
  if (tg_op = 'INSERT') then
    perform public.refresh_projection_for_source(new.source_name);
  elsif (tg_op = 'UPDATE') then
    if new.source_name is distinct from old.source_name then
      perform public.refresh_projection_for_source(old.source_name);
    end if;
    perform public.refresh_projection_for_source(new.source_name);
  elsif (tg_op = 'DELETE') then
    perform public.refresh_projection_for_source(old.source_name);
  end if;
  return null;
end $$;

create trigger trg_fsw_refresh_projection_iud
after insert or update or delete on public.fe_source_workspace_assignments
for each row execute function public.trg_fsw_after_change_refresh();
