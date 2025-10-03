-- Migration: Dédoublonnage des records FR/EN dans emission_factors
-- Date: 2025-09-30
-- Problème: Les données ont été importées en double (une fois avec colonnes FR, une fois avec colonnes EN)
-- Solution: Fusionner les paires FR/EN en un seul record complet

begin;

-- Fonction temporaire pour identifier et fusionner les doublons
create or replace function deduplicate_emission_factors()
returns table(
  merged_count int,
  deleted_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_merged int := 0;
  v_deleted int := 0;
  v_batch_size int := 100;
  v_offset int := 0;
  v_total int;
  rec_fr record;
  rec_en record;
begin
  -- Compter le nombre total de records à traiter
  select count(*) into v_total
  from emission_factors ef_fr
  where ef_fr.is_latest = true
    and ef_fr."Contributeur" is not null
    and ef_fr."Contributeur_en" is null;

  raise notice 'Total records FR à traiter: %', v_total;

  -- Traiter par lots
  while v_offset < v_total loop
    raise notice 'Processing batch starting at offset %', v_offset;

    -- Pour chaque record "FR only" (Contributeur rempli, Contributeur_en NULL)
    for rec_fr in
      select *
      from emission_factors
      where is_latest = true
        and "Contributeur" is not null
        and "Contributeur_en" is null
      order by id
      limit v_batch_size
      offset v_offset
    loop
      -- Chercher le record "EN only" correspondant
      -- (même Nom, FE, Périmètre, Date, Source, mais Contributeur NULL et Contributeur_en rempli)
      select * into rec_en
      from emission_factors
      where is_latest = true
        and "Contributeur" is null
        and "Contributeur_en" is not null
        and "Nom" = rec_fr."Nom"
        and abs(cast("FE" as numeric) - cast(rec_fr."FE" as numeric)) < 0.0001
        and "Périmètre" = rec_fr."Périmètre"
        and "Date" = rec_fr."Date"
        and "Source" = rec_fr."Source"
        and "Localisation" = rec_fr."Localisation"
      limit 1;

      if found then
        -- Fusionner: mettre à jour le record FR avec les valeurs EN manquantes
        update emission_factors
        set
          "Contributeur_en" = rec_en."Contributeur_en",
          "Type_de_données" = coalesce(rec_fr."Type_de_données", rec_en."Type_de_données"),
          "Type_de_données_en" = rec_en."Type_de_données_en",
          "Méthodologie_en" = rec_en."Méthodologie_en",
          updated_at = now()
        where id = rec_fr.id;

        -- Supprimer le record EN devenu redondant
        update emission_factors
        set is_latest = false
        where id = rec_en.id;

        v_merged := v_merged + 1;
        v_deleted := v_deleted + 1;

        if v_merged % 100 = 0 then
          raise notice 'Merged % pairs so far', v_merged;
        end if;
      end if;
    end loop;

    v_offset := v_offset + v_batch_size;
  end loop;

  raise notice 'Deduplication complete: % pairs merged, % duplicates marked as not latest', v_merged, v_deleted;
  
  return query select v_merged, v_deleted;
end;
$$;

-- Exécuter la déduplication
select * from deduplicate_emission_factors();

-- Nettoyer la fonction temporaire
drop function if exists deduplicate_emission_factors();

commit;



