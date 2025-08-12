-- Migration pour corriger les incohérences de quotas
-- Étape 1: Nettoyer les enregistrements avec plan_type NULL
UPDATE search_quotas 
SET plan_type = 'freemium'
WHERE plan_type IS NULL;

-- Étape 2: Synchroniser tous les quotas avec les plans utilisateur
-- Mise à jour pour les utilisateurs freemium
UPDATE search_quotas sq
SET 
  plan_type = 'freemium',
  searches_limit = 10,
  exports_limit = 0,
  updated_at = now()
FROM users u
WHERE sq.user_id = u.user_id 
AND u.plan_type = 'freemium'
AND NOT is_supra_admin(u.user_id);

-- Mise à jour pour les utilisateurs standard
UPDATE search_quotas sq
SET 
  plan_type = 'standard',
  searches_limit = 1000,
  exports_limit = 100,
  updated_at = now()
FROM users u
WHERE sq.user_id = u.user_id 
AND u.plan_type = 'standard'
AND NOT is_supra_admin(u.user_id);

-- Mise à jour pour les utilisateurs premium
UPDATE search_quotas sq
SET 
  plan_type = 'premium',
  searches_limit = NULL,
  exports_limit = NULL,
  updated_at = now()
FROM users u
WHERE sq.user_id = u.user_id 
AND u.plan_type = 'premium'
AND NOT is_supra_admin(u.user_id);

-- Mise à jour pour les supra admins (toujours premium)
UPDATE search_quotas sq
SET 
  plan_type = 'premium',
  searches_limit = NULL,
  exports_limit = NULL,
  updated_at = now()
WHERE is_supra_admin(sq.user_id);

-- Étape 3: Créer les quotas manquants pour les utilisateurs qui n'en ont pas
INSERT INTO search_quotas (
  user_id, 
  plan_type, 
  searches_limit, 
  exports_limit,
  searches_used,
  exports_used
)
SELECT 
  u.user_id,
  CASE 
    WHEN is_supra_admin(u.user_id) THEN 'premium'
    ELSE COALESCE(u.plan_type, 'freemium')
  END as plan_type,
  CASE 
    WHEN is_supra_admin(u.user_id) THEN NULL
    WHEN COALESCE(u.plan_type, 'freemium') = 'premium' THEN NULL
    WHEN COALESCE(u.plan_type, 'freemium') = 'standard' THEN 1000
    ELSE 10
  END as searches_limit,
  CASE 
    WHEN is_supra_admin(u.user_id) THEN NULL
    WHEN COALESCE(u.plan_type, 'freemium') = 'premium' THEN NULL
    WHEN COALESCE(u.plan_type, 'freemium') = 'standard' THEN 100
    ELSE 0
  END as exports_limit,
  0 as searches_used,
  0 as exports_used
FROM users u
WHERE NOT EXISTS (
  SELECT 1 FROM search_quotas sq 
  WHERE sq.user_id = u.user_id
);

-- Étape 4: Ajouter une contrainte pour éviter les plan_type NULL à l'avenir
ALTER TABLE search_quotas 
ALTER COLUMN plan_type SET NOT NULL;

-- Ajouter une contrainte CHECK pour valider les valeurs de plan_type
ALTER TABLE search_quotas 
ADD CONSTRAINT valid_plan_type 
CHECK (plan_type IN ('freemium', 'standard', 'premium'));