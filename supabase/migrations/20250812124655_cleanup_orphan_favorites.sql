-- Migration pour nettoyer les favoris orphelins après la migration vers les nouveaux index Algolia
-- 
-- Problème : Les favoris historiques contiennent des item_id qui correspondent aux anciens objectID
-- de l'index emission_factors, mais ces IDs n'existent plus dans les nouveaux index ef_public_fr et ef_private_fr
--
-- Solution : Identifier et supprimer les favoris orphelins, ou tenter de les remapper si possible

-- Étape 1: Identifier les favoris orphelins
CREATE OR REPLACE FUNCTION identify_orphan_favorites()
RETURNS TABLE (
    user_id uuid,
    item_id text,
    item_data jsonb,
    created_at timestamptz
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.user_id,
        f.item_id,
        f.item_data,
        f.created_at
    FROM favorites f
    WHERE f.item_type = 'emission_factor'
    AND NOT EXISTS (
        -- Vérifier si l'item_id existe dans les nouvelles tables de projection
        SELECT 1 FROM emission_factors_public_search_fr pub WHERE pub.object_id = f.item_id
        UNION
        SELECT 1 FROM emission_factors_private_search_fr priv WHERE priv.object_id = f.item_id
    );
END;
$$ LANGUAGE plpgsql;

-- Étape 2: Fonction pour tenter de remapper les favoris basé sur les données
CREATE OR REPLACE FUNCTION attempt_remap_favorites()
RETURNS INTEGER AS $$
DECLARE
    favorite_record RECORD;
    potential_match RECORD;
    remapped_count INTEGER := 0;
BEGIN
    -- Parcourir les favoris orphelins
    FOR favorite_record IN 
        SELECT * FROM identify_orphan_favorites()
    LOOP
        -- Tenter de trouver un équivalent dans les nouvelles tables basé sur le nom et la source
        SELECT object_id INTO potential_match
        FROM emission_factors_public_search_fr
        WHERE "Nom" = (favorite_record.item_data->>'Nom' OR favorite_record.item_data->>'nom')
        AND "Source" = (favorite_record.item_data->>'Source' OR favorite_record.item_data->>'source')
        AND ("FE")::text = (favorite_record.item_data->>'FE' OR favorite_record.item_data->>'fe')
        LIMIT 1;
        
        -- Si pas trouvé dans public, chercher dans private
        IF potential_match.object_id IS NULL THEN
            SELECT object_id INTO potential_match
            FROM emission_factors_private_search_fr
            WHERE "Nom" = (favorite_record.item_data->>'Nom' OR favorite_record.item_data->>'nom')
            AND "Source" = (favorite_record.item_data->>'Source' OR favorite_record.item_data->>'source')
            AND ("FE")::text = (favorite_record.item_data->>'FE' OR favorite_record.item_data->>'fe')
            LIMIT 1;
        END IF;
        
        -- Si un équivalent est trouvé, mettre à jour le favori
        IF potential_match.object_id IS NOT NULL THEN
            UPDATE favorites 
            SET item_id = potential_match.object_id
            WHERE user_id = favorite_record.user_id 
            AND item_id = favorite_record.item_id 
            AND item_type = 'emission_factor';
            
            remapped_count := remapped_count + 1;
        END IF;
    END LOOP;
    
    RETURN remapped_count;
END;
$$ LANGUAGE plpgsql;

-- Étape 3: Fonction pour supprimer les favoris orphelins restants
CREATE OR REPLACE FUNCTION cleanup_orphan_favorites()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Supprimer les favoris qui ne peuvent pas être remappés
    DELETE FROM favorites 
    WHERE item_type = 'emission_factor'
    AND item_id IN (
        SELECT item_id FROM identify_orphan_favorites()
    );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Étape 4: Fonction de nettoyage complète avec rapport
CREATE OR REPLACE FUNCTION full_favorites_cleanup()
RETURNS jsonb AS $$
DECLARE
    orphan_count INTEGER;
    remapped_count INTEGER;
    deleted_count INTEGER;
    result jsonb;
BEGIN
    -- Compter les favoris orphelins avant traitement
    SELECT COUNT(*) INTO orphan_count FROM identify_orphan_favorites();
    
    -- Tenter de remapper les favoris
    SELECT attempt_remap_favorites() INTO remapped_count;
    
    -- Supprimer les favoris orphelins restants
    SELECT cleanup_orphan_favorites() INTO deleted_count;
    
    -- Retourner un rapport JSON
    result := jsonb_build_object(
        'initial_orphan_count', orphan_count,
        'remapped_count', remapped_count,
        'deleted_count', deleted_count,
        'processed_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Commentaire pour l'usage:
-- Pour exécuter le nettoyage, utiliser : SELECT full_favorites_cleanup();
-- Pour voir les favoris orphelins sans les supprimer : SELECT * FROM identify_orphan_favorites();
