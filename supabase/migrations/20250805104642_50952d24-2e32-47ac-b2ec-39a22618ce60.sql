-- Créer une fonction de migration simplifiée sans ON CONFLICT
CREATE OR REPLACE FUNCTION migrate_to_unified_users_simple() 
RETURNS VOID AS $$
DECLARE
  profile_rec RECORD;
  subscriber_rec RECORD;
  role_rec RECORD;
BEGIN
  -- Migrer depuis user_roles (table principale avec workspace_id)
  FOR role_rec IN 
    SELECT DISTINCT ON (ur.user_id, ur.workspace_id) 
           ur.user_id, ur.workspace_id, ur.role, ur.assigned_by, ur.created_at, ur.updated_at
    FROM user_roles ur 
    WHERE ur.workspace_id IS NOT NULL
    ORDER BY ur.user_id, ur.workspace_id, ur.created_at DESC
  LOOP
    -- Vérifier si l'entrée existe déjà
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE user_id = role_rec.user_id AND workspace_id = role_rec.workspace_id) THEN
      -- Récupérer les données de profil
      SELECT * INTO profile_rec 
      FROM profiles 
      WHERE user_id = role_rec.user_id AND workspace_id = role_rec.workspace_id
      LIMIT 1;
      
      -- Récupérer les données d'abonnement
      SELECT * INTO subscriber_rec 
      FROM subscribers 
      WHERE user_id = role_rec.user_id AND workspace_id = role_rec.workspace_id
      LIMIT 1;
      
      -- Si pas de subscriber, chercher par user_id seulement
      IF subscriber_rec IS NULL THEN
        SELECT * INTO subscriber_rec 
        FROM subscribers 
        WHERE user_id = role_rec.user_id
        LIMIT 1;
      END IF;
      
      -- Insérer dans la nouvelle table
      INSERT INTO public.users (
        user_id, workspace_id, role, assigned_by,
        first_name, last_name, company, position, phone,
        email, plan_type, subscribed, subscription_tier, trial_end, subscription_end,
        created_at, updated_at
      ) VALUES (
        role_rec.user_id,
        role_rec.workspace_id,
        role_rec.role,
        role_rec.assigned_by,
        COALESCE(profile_rec.first_name, ''),
        COALESCE(profile_rec.last_name, ''),
        COALESCE(profile_rec.company, ''),
        COALESCE(profile_rec.position, ''),
        COALESCE(profile_rec.phone, ''),
        COALESCE(subscriber_rec.email, ''),
        COALESCE(subscriber_rec.plan_type, 'freemium'),
        COALESCE(subscriber_rec.subscribed, false),
        subscriber_rec.subscription_tier,
        subscriber_rec.trial_end,
        subscriber_rec.subscription_end,
        LEAST(role_rec.created_at, COALESCE(profile_rec.created_at, role_rec.created_at), COALESCE(subscriber_rec.created_at, role_rec.created_at)),
        GREATEST(role_rec.updated_at, COALESCE(profile_rec.updated_at, role_rec.updated_at), COALESCE(subscriber_rec.updated_at, role_rec.updated_at))
      );
    END IF;
  END LOOP;
  
  -- Gérer les supra_admins (sans workspace_id)
  FOR role_rec IN 
    SELECT ur.user_id, ur.role, ur.assigned_by, ur.created_at, ur.updated_at
    FROM user_roles ur 
    WHERE ur.workspace_id IS NULL AND ur.role = 'supra_admin'
  LOOP
    -- Récupérer les données d'abonnement pour email
    SELECT * INTO subscriber_rec 
    FROM subscribers 
    WHERE user_id = role_rec.user_id
    LIMIT 1;
    
    -- Utiliser le premier workspace trouvé
    DECLARE
      default_workspace_id UUID;
    BEGIN
      SELECT id INTO default_workspace_id FROM workspaces LIMIT 1;
      
      -- Vérifier si l'entrée existe déjà
      IF NOT EXISTS (SELECT 1 FROM public.users WHERE user_id = role_rec.user_id AND workspace_id = default_workspace_id) THEN
        INSERT INTO public.users (
          user_id, workspace_id, role, assigned_by,
          email, plan_type, subscribed,
          created_at, updated_at
        ) VALUES (
          role_rec.user_id,
          default_workspace_id,
          role_rec.role,
          role_rec.assigned_by,
          COALESCE(subscriber_rec.email, ''),
          'premium',
          true,
          role_rec.created_at,
          role_rec.updated_at
        );
      END IF;
    END;
  END LOOP;
  
  RAISE NOTICE 'Migration completed successfully';
END;
$$ LANGUAGE plpgsql;

-- Exécuter la migration simplifiée
SELECT migrate_to_unified_users_simple();