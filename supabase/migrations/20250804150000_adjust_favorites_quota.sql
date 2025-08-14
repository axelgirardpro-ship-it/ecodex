-- Create server-side helper to adjust favorites_used counters
-- Safe to run multiple times

create or replace function public.adjust_favorites_quota(p_user uuid, p_delta integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.search_quotas
  set favorites_used = greatest(0, coalesce(favorites_used, 0) + p_delta),
      updated_at = now()
  where user_id = p_user;
end;
$$;


