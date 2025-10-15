-- ============================================================================
-- SCRIPT DE VALIDATION : Vérifier l'absence de doublons d'ID
-- ============================================================================
-- À exécuter après upload dans staging_emission_factors
-- Date: 14 octobre 2025
-- ============================================================================

-- ============================================================================
-- TEST 1 : Compter les doublons d'ID
-- ============================================================================
-- Résultat attendu: 0 rows (aucun doublon)
-- ============================================================================

SELECT 
    "ID",
    COUNT(*) as occurrences,
    ARRAY_AGG("Nom") as noms,
    ARRAY_AGG("Unité donnée d'activité") as unites,
    ARRAY_AGG("FE") as fe_values
FROM staging_emission_factors
GROUP BY "ID"
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 20;

-- Si ce test retourne des lignes → PROBLÈME : Des doublons existent encore !
-- Si 0 rows → ✅ SUCCÈS : Aucun doublon d'ID


-- ============================================================================
-- TEST 2 : Vérifier la cohérence totale
-- ============================================================================
-- total_records doit être ÉGAL à unique_ids
-- ============================================================================

SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT "ID") as unique_ids,
    CASE 
        WHEN COUNT(*) = COUNT(DISTINCT "ID") THEN '✅ OK: Tous les IDs sont uniques'
        ELSE '❌ ERREUR: ' || (COUNT(*) - COUNT(DISTINCT "ID")) || ' doublons détectés'
    END as status
FROM staging_emission_factors;


-- ============================================================================
-- TEST 3 : Analyser les hash dupliqués (NORMAL si unités différentes)
-- ============================================================================
-- Il est OK d'avoir le même hash SI les unités sont différentes
-- ============================================================================

SELECT 
    natural_key_hash,
    COUNT(*) as occurrences,
    ARRAY_AGG(DISTINCT "Nom") as noms,
    ARRAY_AGG(DISTINCT "Unité donnée d'activité") as unites_distinctes,
    COUNT(DISTINCT "Unité donnée d'activité") as nb_unites,
    COUNT(DISTINCT "ID") as nb_ids_distincts,
    CASE 
        WHEN COUNT(DISTINCT "ID") = COUNT(*) THEN '✅ OK: IDs uniques'
        ELSE '❌ ERREUR: IDs dupliqués pour ce hash'
    END as status
FROM staging_emission_factors
GROUP BY natural_key_hash
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 20;

-- ✅ Résultat attendu: 
--   - Quelques hash dupliqués
--   - MAIS avec des unités différentes
--   - ET nb_ids_distincts = occurrences (pas de doublon d'ID)


-- ============================================================================
-- TEST 4 : Vérifier le cas spécifique "Peintures BIOPRO"
-- ============================================================================
-- Doit montrer 2 records avec des IDs DIFFÉRENTS
-- ============================================================================

SELECT 
    "ID",
    "natural_key_hash",
    "Nom",
    "Unité donnée d'activité" as unite,
    "FE",
    "operation"
FROM staging_emission_factors
WHERE "Nom" LIKE '%BIOPRO%'
    AND "Source" = 'INIES'
ORDER BY "Nom", "Unité donnée d'activité";

-- ✅ Résultat attendu:
--   - 2 lignes (ou plus)
--   - Même Nom
--   - Unités différentes (kg, m²)
--   - IDs DIFFÉRENTS pour chaque unité


-- ============================================================================
-- TEST 5 : Statistiques globales
-- ============================================================================

SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT "ID") as unique_ids,
    COUNT(DISTINCT natural_key_hash) as unique_hashes,
    COUNT(DISTINCT "Nom") as unique_names,
    COUNT(DISTINCT "Unité donnée d'activité") as unique_units,
    ROUND(AVG(CASE WHEN "FE" IS NOT NULL THEN "FE"::numeric ELSE NULL END), 2) as avg_fe,
    COUNT(*) - COUNT(DISTINCT "ID") as nb_doublons_id,
    CASE 
        WHEN COUNT(*) = COUNT(DISTINCT "ID") THEN '✅ VALIDATION RÉUSSIE'
        ELSE '❌ VALIDATION ÉCHOUÉE'
    END as validation_status
FROM staging_emission_factors;


-- ============================================================================
-- TEST 6 : Identifier les records problématiques (si doublons subsistent)
-- ============================================================================
-- À n'exécuter QUE si le TEST 1 retourne des doublons
-- ============================================================================

/*
WITH duplicated_ids AS (
    SELECT "ID"
    FROM staging_emission_factors
    GROUP BY "ID"
    HAVING COUNT(*) > 1
)
SELECT 
    s."ID",
    s.natural_key_hash,
    s."Nom",
    s."Unité donnée d'activité",
    s."FE",
    s."Périmètre",
    s."Source",
    s."Date",
    s.operation
FROM staging_emission_factors s
INNER JOIN duplicated_ids d ON s."ID" = d."ID"
ORDER BY s."ID", s."Unité donnée d'activité";
*/

-- Décommenter et exécuter ce test si des doublons sont détectés


-- ============================================================================
-- RÉSUMÉ DES TESTS
-- ============================================================================
-- 
-- ✅ VALIDATION RÉUSSIE SI :
--   - TEST 1 : 0 rows (aucun doublon d'ID)
--   - TEST 2 : total_records = unique_ids
--   - TEST 3 : Quelques hash dupliqués OK, mais IDs toujours uniques
--   - TEST 4 : Peintures BIOPRO avec IDs différents par unité
--   - TEST 5 : nb_doublons_id = 0, status = "VALIDATION RÉUSSIE"
-- 
-- ❌ PROBLÈME SI :
--   - TEST 1 : Retourne des lignes
--   - TEST 2 : total_records > unique_ids
--   - TEST 5 : nb_doublons_id > 0, status = "VALIDATION ÉCHOUÉE"
-- 
-- ACTIONS EN CAS DE PROBLÈME :
--   1. Vérifier que le code Python contient bien 'Unité donnée d\'activité' dans NATURAL_KEY
--   2. Vérifier que la déduplication automatique est activée
--   3. Relancer le traitement Dataiku
--   4. Si le problème persiste, consulter INSTRUCTIONS_FIX_DOUBLONS.md
-- 
-- ============================================================================

