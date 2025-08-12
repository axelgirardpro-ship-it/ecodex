-- Créer la fonction de migration sans ON CONFLICT
CREATE OR REPLACE FUNCTION migrate_users_data() 
RETURNS VOID AS $$
DECLARE
  profile_rec RECORD;
  subscriber_rec RECORD;
  role_rec RECORD;
BEGIN
  -- Migrer depuis user_roles
  FOR role_rec IN 
    SELECT DISTINCT ON (ur.user_id, ur.workspace_id) 
           ur.user_id, ur.workspace_id, ur.role, ur.assigned_by, ur.created_at, ur.updated_at
    FROM user_roles ur 
    WHERE ur.workspace_id IS NOT NULL
    ORDER BY ur.user_id, ur.workspace_id, ur.created_at DESC
  LOOP
    -- Vérifier si déjà migré
    IF NOT EXISTS (
      SELECT 1 FROM public.users 
      WHERE user_id = role_rec.user_id AND workspace_id = role_rec.workspace_id
    ) THEN
      -- Récupérer profil
      SELECT * INTO profile_rec 
      FROM profiles 
      WHERE user_id = role_rec.user_id AND workspace_id = role_rec.workspace_id
      LIMIT 1;
      
      -- Récupérer abonnement
      SELECT * INTO subscriber_rec 
      FROM subscribers 
      WHERE user_id = role_rec.user_id
      LIMIT 1;
      
      -- Insérer
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
        COALESCE(role_rec.created_at, now()),
        COALESCE(role_rec.updated_at, now())
      );
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Migration terminée avec succès';
END;
$$ LANGUAGE plpgsql;

-- Exécuter la migration
SELECT migrate_users_data();

-- Maintenant nettoyer les colonnes Stripe inutiles
ALTER TABLE public.workspaces DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE public.subscribers DROP COLUMN IF EXISTS stripe_customer_id;