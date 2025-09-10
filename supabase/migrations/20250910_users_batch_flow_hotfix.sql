begin;

-- 1) Wrapper pour compat: refresh_projection_for_source -> refresh_ef_all_for_source
create or replace function public.refresh_projection_for_source(p_source text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_ef_all_for_source(p_source);
end $$;

-- 2) Restreindre auto-assignation aux sources globales (is_global=true) et standard
create or replace function public.auto_assign_sources_on_fe_sources()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if ((tg_op = 'INSERT' and new.access_level = 'standard' and new.is_global = true)
      or (tg_op = 'UPDATE' and new.access_level = 'standard' and new.is_global = true
          and (old.access_level is distinct from new.access_level or old.is_global is distinct from new.is_global))) then
    insert into public.fe_source_workspace_assignments (source_name, workspace_id, assigned_by)
    select new.source_name, w.id, null from public.workspaces w
    on conflict do nothing;
  end if;
  return new;
end $$;

-- Backfill de sécurité: s'assurer que seules les sources standard ET globales sont assignées massivement
-- (pas d'action destructive ici pour ne pas casser les assignations existantes spécifiques)

commit;

