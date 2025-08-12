-- Script de diagnostic des favoris après migration vers les nouveaux index Algolia
-- À exécuter pour comprendre l'ampleur du problème avant nettoyage

-- 1. Compter le nombre total de favoris
SELECT 
    'Total favoris' as metric,
    COUNT(*) as count
FROM favorites 
WHERE item_type = 'emission_factor';

-- 2. Compter les favoris orphelins (IDs qui n'existent plus)
SELECT 
    'Favoris orphelins' as metric,
    COUNT(*) as count
FROM favorites f
WHERE f.item_type = 'emission_factor'
AND NOT EXISTS (
    SELECT 1 FROM emission_factors_public_search_fr pub WHERE pub.object_id = f.item_id
    UNION
    SELECT 1 FROM emission_factors_private_search_fr priv WHERE priv.object_id = f.item_id
);

-- 3. Analyser les favoris orphelins par utilisateur
SELECT 
    u.email,
    COUNT(*) as orphan_favorites,
    COUNT(*) * 100.0 / (
        SELECT COUNT(*) 
        FROM favorites f2 
        WHERE f2.user_id = f.user_id 
        AND f2.item_type = 'emission_factor'
    ) as percentage_orphan
FROM favorites f
JOIN auth.users u ON f.user_id = u.id
WHERE f.item_type = 'emission_factor'
AND NOT EXISTS (
    SELECT 1 FROM emission_factors_public_search_fr pub WHERE pub.object_id = f.item_id
    UNION
    SELECT 1 FROM emission_factors_private_search_fr priv WHERE priv.object_id = f.item_id
)
GROUP BY f.user_id, u.email
ORDER BY orphan_favorites DESC;

-- 4. Exemples de favoris orphelins (pour comprendre le format des données)
SELECT 
    f.item_id,
    f.item_data->>'Nom' as nom,
    f.item_data->>'Source' as source,
    f.item_data->>'FE' as fe,
    f.created_at
FROM favorites f
WHERE f.item_type = 'emission_factor'
AND NOT EXISTS (
    SELECT 1 FROM emission_factors_public_search_fr pub WHERE pub.object_id = f.item_id
    UNION
    SELECT 1 FROM emission_factors_private_search_fr priv WHERE priv.object_id = f.item_id
)
LIMIT 10;

-- 5. Vérifier s'il y a des favoris avec des IDs valides
SELECT 
    'Favoris valides (public)' as metric,
    COUNT(*) as count
FROM favorites f
WHERE f.item_type = 'emission_factor'
AND EXISTS (
    SELECT 1 FROM emission_factors_public_search_fr pub WHERE pub.object_id = f.item_id
);

SELECT 
    'Favoris valides (private)' as metric,
    COUNT(*) as count
FROM favorites f
WHERE f.item_type = 'emission_factor'
AND EXISTS (
    SELECT 1 FROM emission_factors_private_search_fr priv WHERE priv.object_id = f.item_id
);

-- 6. Analyser la structure des objectID dans les nouvelles tables
SELECT 
    'Exemple objectID public' as type,
    object_id,
    "Nom",
    "Source"
FROM emission_factors_public_search_fr
LIMIT 5;

SELECT 
    'Exemple objectID private' as type,
    object_id,
    "Nom", 
    "Source"
FROM emission_factors_private_search_fr
LIMIT 5;
