-- Export COMPLET des vrais doublons - VERSION CORRIGÉE
-- Fix: Nettoyage des espaces Unicode (U+202F) dans FE avant conversion
-- À exécuter dans l'interface SQL de Supabase

WITH prepared_data AS (
  SELECT
    "ID",
    coalesce(nullif(btrim("Nom"), ''), nullif(btrim("Nom_en"), '')) AS "Nom",
    nullif(btrim("Nom_en"), '') AS "Nom_en",
    -- ✅ FIX: Nettoyer les espaces avant conversion
    CASE 
      WHEN "FE" IS NOT NULL AND btrim("FE") != '' 
      THEN regexp_replace(btrim("FE"), '\s+', '', 'g')::numeric 
      ELSE NULL 
    END AS "FE",
    coalesce(nullif(btrim("Unité donnée d'activité"), ''), nullif(btrim("Unite_en"), '')) AS "Unite",
    nullif(btrim("Source"), '') AS "Source",
    "Date",
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
      NULL, 
      NULL,
      -- ✅ FIX: Nettoyer les espaces avant conversion dans calculate_factor_key aussi
      CASE 
        WHEN "FE" IS NOT NULL AND btrim("FE") != '' 
        THEN regexp_replace(btrim("FE"), '\s+', '', 'g')::numeric 
        ELSE NULL 
      END,
      -- ✅ FIX: Gérer aussi la conversion de Date
      CASE 
        WHEN "Date" IS NOT NULL 
        THEN "Date"::integer 
        ELSE NULL 
      END
    ) AS factor_key,
    ROW_NUMBER() OVER (PARTITION BY 
      public.calculate_factor_key(
        coalesce(nullif(btrim("Nom"), ''), nullif(btrim("Nom_en"), '')),
        coalesce(nullif(btrim("Unité donnée d'activité"), ''), nullif(btrim("Unite_en"), '')),
        nullif(btrim("Source"), ''),
        coalesce(nullif(btrim("Périmètre"), ''), nullif(btrim("Périmètre_en"), '')),
        coalesce(nullif(btrim("Localisation"), ''), nullif(btrim("Localisation_en"), '')),
        NULL, 
        NULL,
        CASE 
          WHEN "FE" IS NOT NULL AND btrim("FE") != '' 
          THEN regexp_replace(btrim("FE"), '\s+', '', 'g')::numeric 
          ELSE NULL 
        END,
        CASE 
          WHEN "Date" IS NOT NULL 
          THEN "Date"::integer 
          ELSE NULL 
        END
      )
      ORDER BY "ID"
    ) AS row_num
  FROM staging_emission_factors
  WHERE "FE" IS NOT NULL
    AND coalesce(nullif(btrim("Unité donnée d'activité"), ''), nullif(btrim("Unite_en"), '')) IS NOT NULL
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
-- 
-- Note: Cette version nettoie automatiquement les espaces Unicode (U+202F) 
-- présents dans certaines valeurs FE (ex: "2 051", "3 087")

