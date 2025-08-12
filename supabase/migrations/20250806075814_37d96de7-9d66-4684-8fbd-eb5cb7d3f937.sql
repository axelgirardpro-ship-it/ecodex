-- Corriger les quotas pour qu'ils correspondent aux plans des utilisateurs
-- Mettre à jour les quotas selon les règles par plan

-- Fonction pour synchroniser les quotas avec les plans
CREATE OR REPLACE FUNCTION sync_user_quotas_with_plans()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_rec RECORD;
  user_plan TEXT;
  searches_limit_val INTEGER;
  exports_limit_val INTEGER;
BEGIN
  -- Parcourir tous les utilisateurs avec des quotas
  FOR user_rec IN 
    SELECT DISTINCT user_id FROM search_quotas
  LOOP
    -- Obtenir le plan de l'utilisateur
    SELECT get_user_workspace_plan(user_rec.user_id) INTO user_plan;
    
    -- Si l'utilisateur est supra admin, forcer le plan premium
    IF is_supra_admin(user_rec.user_id) THEN
      user_plan := 'premium';
    END IF;
    
    -- Définir les limites selon le plan
    CASE user_plan
      WHEN 'premium' THEN
        searches_limit_val := NULL; -- Illimité
        exports_limit_val := NULL;  -- Illimité
      WHEN 'standard' THEN
        searches_limit_val := 1000;
        exports_limit_val := 100;
      ELSE -- freemium
        searches_limit_val := 10;
        exports_limit_val := 0;
    END CASE;
    
    -- Mettre à jour les quotas
    UPDATE search_quotas 
    SET 
      plan_type = user_plan,
      searches_limit = searches_limit_val,
      exports_limit = exports_limit_val,
      updated_at = now()
    WHERE user_id = user_rec.user_id;
    
  END LOOP;
  
  RAISE NOTICE 'Synchronisation des quotas terminée';
END;
$$;

-- Exécuter la synchronisation
SELECT sync_user_quotas_with_plans();