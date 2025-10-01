-- Migration: Dédoublonnage des records FR/EN dans emission_factors (version optimisée)
-- Date: 2025-09-30
-- Problème: Les données ont été importées en double (une fois avec colonnes FR, une fois avec colonnes EN)
-- Solution: Fusionner les paires FR/EN en un seul record complet avec UPDATE JOIN

begin;

-- Étape 1: Mettre à jour les records FR avec les valeurs EN manquantes
update emission_factors ef_fr
set
  "Contributeur_en" = ef_en."Contributeur_en",
  "Type_de_données" = coalesce(ef_fr."Type_de_données", ef_en."Type_de_données"),
  "Type_de_données_en" = ef_en."Type_de_données_en",
  "Méthodologie_en" = ef_en."Méthodologie_en",
  updated_at = now()
from emission_factors ef_en
where ef_fr.is_latest = true
  and ef_fr."Contributeur" is not null
  and ef_fr."Contributeur_en" is null
  and ef_en.is_latest = true
  and ef_en."Contributeur" is null
  and ef_en."Contributeur_en" is not null
  and ef_fr."Nom" = ef_en."Nom"
  and abs(cast(ef_fr."FE" as numeric) - cast(ef_en."FE" as numeric)) < 0.0001
  and ef_fr."Périmètre" = ef_en."Périmètre"
  and ef_fr."Date" = ef_en."Date"
  and ef_fr."Source" = ef_en."Source"
  and ef_fr."Localisation" = ef_en."Localisation";

-- Étape 2: Marquer les records EN comme obsolètes (is_latest = false)
update emission_factors ef_en
set is_latest = false
from emission_factors ef_fr
where ef_en.is_latest = true
  and ef_en."Contributeur" is null
  and ef_en."Contributeur_en" is not null
  and ef_fr.is_latest = true
  and ef_fr."Contributeur" is not null
  -- ef_fr."Contributeur_en" pourrait maintenant être rempli suite à l'étape 1
  and ef_fr."Nom" = ef_en."Nom"
  and abs(cast(ef_fr."FE" as numeric) - cast(ef_en."FE" as numeric)) < 0.0001
  and ef_fr."Périmètre" = ef_en."Périmètre"
  and ef_fr."Date" = ef_en."Date"
  and ef_fr."Source" = ef_en."Source"
  and ef_fr."Localisation" = ef_en."Localisation";

-- Vérifier les résultats
do $$
declare
  v_remaining_fr int;
  v_remaining_en int;
  v_merged int;
begin
  select count(*) into v_remaining_fr
  from emission_factors
  where is_latest = true
    and "Contributeur" is not null
    and "Contributeur_en" is null;

  select count(*) into v_remaining_en
  from emission_factors
  where is_latest = true
    and "Contributeur" is null
    and "Contributeur_en" is not null;

  select count(*) into v_merged
  from emission_factors
  where is_latest = true
    and "Contributeur" is not null
    and "Contributeur_en" is not null;

  raise notice 'Deduplication complete:';
  raise notice '- Records FR-only remaining: %', v_remaining_fr;
  raise notice '- Records EN-only remaining: %', v_remaining_en;
  raise notice '- Records with both FR and EN: %', v_merged;
end $$;

commit;


