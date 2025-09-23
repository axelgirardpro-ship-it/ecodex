-- Nettoyage des IDs redondants pour les imports utilisateurs (projection Algolia + overlays)
BEGIN;

-- 1) Retirer record_id de user_batch_algolia (plus utilisé par le connecteur Algolia privé)
ALTER TABLE public.user_batch_algolia
  DROP COLUMN IF EXISTS record_id;

-- 2) Retirer la colonne CSV "ID" des overlays utilisateurs (overlay_id et factor_key suffisent)
ALTER TABLE public.user_factor_overlays
  DROP COLUMN IF EXISTS "ID";

-- 3) Recréer user_batch_algolia sans record_id (projection batch utilisée par la Task Algolia user)
CREATE OR REPLACE FUNCTION public.prepare_user_batch_projection(
  p_workspace_id uuid,
  p_dataset_name text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  IF p_workspace_id IS NULL OR coalesce(trim(p_dataset_name),'') = '' THEN
    RAISE EXCEPTION 'workspace_id et dataset_name requis';
  END IF;

  TRUNCATE TABLE public.user_batch_algolia;

  INSERT INTO public.user_batch_algolia (
    workspace_id, dataset_name, scope, access_level, languages,
    "Nom_fr","Description_fr","Commentaires_fr","Secteur_fr","Sous-secteur_fr","Périmètre_fr","Localisation_fr","Unite_fr",
    "Nom_en","Description_en","Commentaires_en","Secteur_en","Sous-secteur_en","Périmètre_en","Localisation_en","Unite_en",
    "FE","Date","Incertitude","Source"
  )
  SELECT
    sui.workspace_id,
    sui.dataset_name,
    'private' AS scope,
    coalesce(fs.access_level, 'standard') AS access_level,
    array_remove(array[
      CASE WHEN (sui."Nom" IS NOT NULL OR sui."Description" IS NOT NULL OR sui."Unité donnée d'activité" IS NOT NULL OR sui."Secteur" IS NOT NULL OR sui."Localisation" IS NOT NULL) THEN 'fr' END,
      CASE WHEN (sui."Nom_en" IS NOT NULL OR sui."Description_en" IS NOT NULL OR sui."Unite_en" IS NOT NULL OR sui."Secteur_en" IS NOT NULL OR sui."Localisation_en" IS NOT NULL) THEN 'en' END
    ], NULL)::text[] AS languages,
    sui."Nom" AS "Nom_fr",
    sui."Description" AS "Description_fr",
    sui."Commentaires" AS "Commentaires_fr",
    sui."Secteur" AS "Secteur_fr",
    sui."Sous-secteur" AS "Sous-secteur_fr",
    sui."Périmètre" AS "Périmètre_fr",
    sui."Localisation" AS "Localisation_fr",
    sui."Unité donnée d'activité" AS "Unite_fr",
    sui."Nom_en",
    sui."Description_en",
    sui."Commentaires_en",
    sui."Secteur_en",
    sui."Sous-secteur_en",
    sui."Périmètre_en",
    sui."Localisation_en",
    sui."Unite_en",
    public.safe_to_numeric(nullif(sui."FE",'')) AS "FE",
    CASE WHEN trim(coalesce(sui."Date",'')) ~ '^\d+$' THEN trim(sui."Date")::int ELSE NULL END AS "Date",
    sui."Incertitude",
    sui."Source"
  FROM public.staging_user_imports sui
  LEFT JOIN public.fe_sources fs ON fs.source_name = sui.dataset_name
  WHERE sui.workspace_id = p_workspace_id AND sui.dataset_name = p_dataset_name;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- 4) Mettre à jour batch_upsert_user_factor_overlays pour ignorer la colonne "ID"
CREATE OR REPLACE FUNCTION public.batch_upsert_user_factor_overlays(
  p_workspace_id uuid,
  p_dataset_name text,
  p_records jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted int := 0;
  v_updated int := 0;
BEGIN
  IF p_records IS NULL OR jsonb_typeof(p_records) <> 'array' THEN
    RAISE EXCEPTION 'p_records doit être un tableau JSON';
  END IF;

  WITH incoming AS (
    SELECT
      p_workspace_id AS workspace_id,
      p_dataset_name AS dataset_name,
      (rec->>'Nom') AS "Nom",
      (rec->>'Nom_en') AS "Nom_en",
      (rec->>'Description') AS "Description",
      (rec->>'Description_en') AS "Description_en",
      (rec->>'FE') AS "FE",
      (rec->>'Unité donnée d''activité') AS "Unité donnée d'activité",
      (rec->>'Unite_en') AS "Unite_en",
      (rec->>'Source') AS "Source",
      (rec->>'Secteur') AS "Secteur",
      (rec->>'Secteur_en') AS "Secteur_en",
      (rec->>'Sous-secteur') AS "Sous-secteur",
      (rec->>'Sous-secteur_en') AS "Sous-secteur_en",
      (rec->>'Localisation') AS "Localisation",
      (rec->>'Localisation_en') AS "Localisation_en",
      (rec->>'Date') AS "Date",
      (rec->>'Incertitude') AS "Incertitude",
      (rec->>'Périmètre') AS "Périmètre",
      (rec->>'Périmètre_en') AS "Périmètre_en",
      (rec->>'Contributeur') AS "Contributeur",
      (rec->>'Commentaires') AS "Commentaires",
      (rec->>'Commentaires_en') AS "Commentaires_en"
    FROM jsonb_array_elements(p_records) AS rec
  ), prepared AS (
    SELECT
      workspace_id,
      dataset_name,
      public.safe_to_numeric(nullif("FE", '')) AS fe_num,
      CASE WHEN trim(coalesce("Date",'')) ~ '^\d+$' THEN trim("Date")::int ELSE NULL END AS date_int,
      coalesce(nullif("Nom", ''), nullif("Nom_en", '')) AS nom,
      coalesce(nullif("Unité donnée d'activité", ''), null) AS unite,
      coalesce(nullif("Source", ''), null) AS source,
      coalesce(nullif("Périmètre", ''), nullif("Périmètre_en", '')) AS perimetre,
      coalesce(nullif("Localisation", ''), nullif("Localisation_en", '')) AS localisation,
      incoming.*
    FROM incoming
  ),
  keyed AS (
    SELECT *, public.calculate_factor_key(
      p_nom := nom,
      p_unite := unite,
      p_source := source,
      p_perimetre := perimetre,
      p_localisation := localisation,
      p_workspace_id := NULL,
      p_language := NULL,
      p_fe := fe_num,
      p_date := date_int
    ) AS factor_key
    FROM prepared
  ), upsert AS (
    INSERT INTO public.user_factor_overlays AS ufo (
      workspace_id, dataset_name, factor_key,
      "Nom","Nom_en","Description","Description_en","FE","Unité donnée d'activité","Unite_en","Source",
      "Secteur","Secteur_en","Sous-secteur","Sous-secteur_en","Localisation","Localisation_en","Date","Incertitude",
      "Périmètre","Périmètre_en","Contributeur","Commentaires","Commentaires_en", updated_at
    )
    SELECT
      workspace_id, dataset_name, factor_key,
      "Nom","Nom_en","Description","Description_en","FE","Unité donnée d'activité","Unite_en","Source",
      "Secteur","Secteur_en","Sous-secteur","Sous-secteur_en","Localisation","Localisation_en","Date","Incertitude",
      "Périmètre","Périmètre_en","Contributeur","Commentaires","Commentaires_en", now()
    FROM keyed
    WHERE factor_key IS NOT NULL
    ON CONFLICT (workspace_id, factor_key) DO UPDATE
      SET dataset_name = excluded.dataset_name,
          "Nom" = excluded."Nom",
          "Nom_en" = excluded."Nom_en",
          "Description" = excluded."Description",
          "Description_en" = excluded."Description_en",
          "FE" = excluded."FE",
          "Unité donnée d'activité" = excluded."Unité donnée d'activité",
          "Unite_en" = excluded."Unite_en",
          "Source" = excluded."Source",
          "Secteur" = excluded."Secteur",
          "Secteur_en" = excluded."Secteur_en",
          "Sous-secteur" = excluded."Sous-secteur",
          "Sous-secteur_en" = excluded."Sous-secteur_en",
          "Localisation" = excluded."Localisation",
          "Localisation_en" = excluded."Localisation_en",
          "Date" = excluded."Date",
          "Incertitude" = excluded."Incertitude",
          "Périmètre" = excluded."Périmètre",
          "Périmètre_en" = excluded."Périmètre_en",
          "Contributeur" = excluded."Contributeur",
          "Commentaires" = excluded."Commentaires",
          "Commentaires_en" = excluded."Commentaires_en",
          updated_at = now()
    RETURNING (xmax = 0) AS inserted
  )
  SELECT
    COUNT(*) FILTER (WHERE inserted),
    COUNT(*) FILTER (WHERE NOT inserted)
  INTO v_inserted, v_updated
  FROM upsert;

  RETURN jsonb_build_object('inserted', v_inserted, 'updated', v_updated);
END;
$$;

COMMIT;

