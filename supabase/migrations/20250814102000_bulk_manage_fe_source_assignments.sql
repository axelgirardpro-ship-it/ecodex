-- Crée la RPC manquante utilisée par l'Edge Function manage-fe-source-assignments-bulk
create or replace function public.bulk_manage_fe_source_assignments(
  p_workspace_id uuid,
  p_assigned_source_names text[],
  p_unassigned_source_names text[]
)
returns void
language plpgsql
security definer
as $$
begin
  -- Upsert des assignations demandées (ignorer si déjà présentes)
  if array_length(p_assigned_source_names, 1) is not null then
    insert into public.fe_source_workspace_assignments (source_name, workspace_id)
    select src_name, p_workspace_id
    from unnest(p_assigned_source_names) as src_name
    on conflict (source_name, workspace_id) do nothing;
  end if;

  -- Suppression des assignations demandées
  if array_length(p_unassigned_source_names, 1) is not null then
    delete from public.fe_source_workspace_assignments f
    where f.workspace_id = p_workspace_id
      and f.source_name = any(p_unassigned_source_names);
  end if;

  return;
end;
$$;

comment on function public.bulk_manage_fe_source_assignments(uuid, text[], text[])
is 'Gère en masse les assignations de sources FE à un workspace (upserts + suppressions).';
