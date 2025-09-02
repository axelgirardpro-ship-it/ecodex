create or replace function public.batch_replace_all_emission_factors(p_records jsonb)
returns table(processed integer, inserted integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
  v_processed integer;
begin
  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    return query select 0, 0;
    return;
  end if;

  v_processed := jsonb_array_length(p_records);

  -- REPLACE ALL GLOBAL: vider complètement la table (toutes langues, tous workspaces)
  -- Les langues sont gérées via les champs Nom/Nom_en, Description/Description_en, etc.
  truncate table emission_factors restart identity;

  -- Bulk insert optimisé
  with ins as (
    insert into emission_factors (
      factor_key, version_id, is_latest, valid_from, language,
      "Nom","Description","FE","Unité donnée d'activité","Source","Secteur","Sous-secteur","Localisation","Date","Incertitude",
      "Périmètre","Contributeur","Commentaires","Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
      workspace_id
    )
    select
      x.factor_key,
      coalesce(x.version_id, gen_random_uuid()),
      coalesce(x.is_latest, true),
      coalesce(x.valid_from, now()),
      x.language,
      x."Nom", x."Description", x."FE", x."Unité donnée d'activité", x."Source", x."Secteur", x."Sous-secteur", x."Localisation", x."Date", x."Incertitude",
      x."Périmètre", x."Contributeur", x."Commentaires", x."Nom_en", x."Description_en", x."Commentaires_en", x."Secteur_en", x."Sous-secteur_en", x."Périmètre_en", x."Localisation_en", x."Unite_en",
      x.workspace_id
    from jsonb_to_recordset(p_records) as x(
      factor_key text,
      version_id uuid,
      is_latest boolean,
      valid_from timestamptz,
      language text,
      "Nom" text,
      "Description" text,
      "FE" numeric,
      "Unité donnée d'activité" text,
      "Source" text,
      "Secteur" text,
      "Sous-secteur" text,
      "Localisation" text,
      "Date" numeric,
      "Incertitude" text,
      "Périmètre" text,
      "Contributeur" text,
      "Commentaires" text,
      "Nom_en" text,
      "Description_en" text,
      "Commentaires_en" text,
      "Secteur_en" text,
      "Sous-secteur_en" text,
      "Périmètre_en" text,
      "Localisation_en" text,
      "Unite_en" text,
      workspace_id uuid
    )
    returning 1
  )
  select count(*) into v_inserted from ins;

  return query select v_processed, v_inserted;
end;
$$;

grant execute on function public.batch_replace_all_emission_factors(jsonb) to anon, authenticated, service_role;
