-- Export COMPLET des vrais doublons (8,837 lignes)
-- À exécuter dans l'interface SQL de Supabase
-- Puis copier-coller les résultats dans Excel/Numbers

WITH prepared_data AS (
  SELECT
    "ID",
    coalesce(nullif(btrim("Nom"), ''), nullif(btrim("Nom_en"), '')) AS "Nom",
    nullif(btrim("Nom_en"), '') AS "Nom_en",
    public.safe_to_numeric(nullif(btrim("FE"), '')) AS "FE",
    coalesce(nullif(btrim("Unité donnée d'activité"), ''), nullif(btrim("Unite_en"), '')) AS "Unite",
    nullif(btrim("Source"), '') AS "Source",
    public.safe_to_int(nullif(btrim("Date"), '')) AS "Date",
    coalesce(nullif(btrim("Périmètre"), ''), nullif(btrim("Périmètre_en"), '')) AS "Perimetre",
    coalesce(nullif(btrim("Localisation"), ''), nullif(btrim("Localisation_en"), '')) AS "Localisation",
    nullif(btrim("Contributeur"), '') AS "Contributeur",
    nullif(btrim("Description"), '') AS "Description",
    public.calculate_factor_key(
      coalesce(nullif(btrim("Nom"), ''), nullif(btrim("Nom_en"), '')),
      coalesce(nullif(btrim("Unité donnée d'activité"), ''), nullif(btrim("Unite_en"), '')),
      nullif(btrim("Source"), ''),
      coalesce(nullif(btrim("Périmètre"), ''), nullif(btrim("Périmètre_en"), '')),
      coalesce(nullif(btrim("Localisation"), ''), nullif(btrim("Localisation_en"), '')),
      NULL, NULL,
      public.safe_to_numeric(nullif(btrim("FE"), '')),
      public.safe_to_int(nullif(btrim("Date"), ''))
    ) AS factor_key,
    ROW_NUMBER() OVER (PARTITION BY 
      public.calculate_factor_key(
        coalesce(nullif(btrim("Nom"), ''), nullif(btrim("Nom_en"), '')),
        coalesce(nullif(btrim("Unité donnée d'activité"), ''), nullif(btrim("Unite_en"), '')),
        nullif(btrim("Source"), ''),
        coalesce(nullif(btrim("Périmètre"), ''), nullif(btrim("Périmètre_en"), '')),
        coalesce(nullif(btrim("Localisation"), ''), nullif(btrim("Localisation_en"), '')),
        NULL, NULL,
        public.safe_to_numeric(nullif(btrim("FE"), '')),
        public.safe_to_int(nullif(btrim("Date"), ''))
      )
      ORDER BY "ID"
    ) AS row_num
  FROM staging_emission_factors
  WHERE nullif(btrim("FE"), '') IS NOT NULL
    AND nullif(btrim("Unité donnée d'activité"), '') IS NOT NULL
),
duplicates AS (
  SELECT 
    factor_key,
    COUNT(*) as dup_count
  FROM prepared_data
  GROUP BY factor_key
  HAVING COUNT(*) > 1
)
SELECT 
  pd."ID",
  pd."Nom",
  pd."Nom_en",
  pd."FE"::text AS "FE",
  pd."Unite",
  pd."Source",
  pd."Date"::text AS "Date",
  pd."Perimetre",
  pd."Localisation",
  pd."Contributeur",
  LEFT(pd."Description", 100) AS "Description_court",
  d.dup_count AS "Nombre_total_doublons",
  pd.row_num AS "Position_dans_groupe",
  CASE 
    WHEN pd.row_num = 1 THEN 'CONSERVÉ' 
    ELSE 'ÉLIMINÉ' 
  END AS "Statut"
FROM prepared_data pd
JOIN duplicates d ON d.factor_key = pd.factor_key
ORDER BY d.dup_count DESC, pd.factor_key, pd.row_num;

-- Pour export CSV : Cliquer sur "Download CSV" dans l'interface Supabase
-- Nombre total de lignes : 8,837
-- Lignes conservées : 3,584
-- Lignes éliminées : 5,253

