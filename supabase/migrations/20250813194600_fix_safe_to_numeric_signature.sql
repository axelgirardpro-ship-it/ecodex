-- Surcharges pour safe_to_numeric
create or replace function public.safe_to_numeric(v numeric)
returns numeric
language plpgsql
as $$
begin
  return v;
end; $$;

create or replace function public.safe_to_numeric(v text)
returns numeric
language plpgsql
as $$
declare n numeric; begin
  if v is null or btrim(v) = '' then return null; end if;
  begin
    n := v::numeric; return n;
  exception when invalid_text_representation then
    return null;
  end;
end; $$;

