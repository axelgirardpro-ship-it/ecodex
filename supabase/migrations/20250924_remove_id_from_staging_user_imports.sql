-- Suppression de la colonne ID obsolète de staging_user_imports
-- Cette colonne n'est plus nécessaire car les imports utilisateur génèrent des object_id uniques

-- Supprimer la colonne ID de staging_user_imports
alter table public.staging_user_imports
  drop column if exists "ID";

-- Vérifier que la colonne a bien été supprimée
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'staging_user_imports' 
    and column_name = 'ID'
  ) then
    raise exception 'La colonne ID existe encore dans staging_user_imports';
  else
    raise notice 'Colonne ID supprimée avec succès de staging_user_imports';
  end if;
end $$;
