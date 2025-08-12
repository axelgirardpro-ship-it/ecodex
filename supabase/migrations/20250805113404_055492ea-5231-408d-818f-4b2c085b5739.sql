-- Migration complète des utilisateurs de user_roles vers users
-- Avec génération de données fictives cohérentes

DO $$
DECLARE
  role_rec RECORD;
  workspace_rec RECORD;
  user_email TEXT;
  user_first_name TEXT;
  user_last_name TEXT;
  user_company TEXT;
  user_position TEXT;
  user_plan TEXT;
  user_subscribed BOOLEAN;
  default_workspace_id UUID;
BEGIN
  -- Obtenir le premier workspace pour les supra_admins
  SELECT id INTO default_workspace_id FROM workspaces LIMIT 1;
  
  -- Si pas de workspace, en créer un par défaut
  IF default_workspace_id IS NULL THEN
    INSERT INTO workspaces (name, owner_id, plan_type)
    VALUES ('Default Workspace', 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7', 'premium')
    RETURNING id INTO default_workspace_id;
  END IF;

  -- Parcourir tous les enregistrements de user_roles
  FOR role_rec IN 
    SELECT DISTINCT ur.user_id, ur.workspace_id, ur.role, ur.assigned_by, ur.created_at, ur.updated_at
    FROM user_roles ur
  LOOP
    -- Déterminer le workspace_id à utiliser
    IF role_rec.workspace_id IS NULL THEN
      role_rec.workspace_id := default_workspace_id;
    END IF;
    
    -- Récupérer les infos du workspace
    SELECT * INTO workspace_rec FROM workspaces WHERE id = role_rec.workspace_id;
    
    -- Génération des données utilisateur
    IF role_rec.user_id = 'd6846f0e-31d0-4b4a-b287-07d79b7ff7b7' THEN
      -- Données réelles pour Axel Girard
      user_email := 'axelgirard.pro@gmail.com';
      user_first_name := 'Axel';
      user_last_name := 'Girard';
      user_company := COALESCE(workspace_rec.name, 'My Workspace');
      user_position := CASE role_rec.role
        WHEN 'admin' THEN 'Administrateur'
        WHEN 'supra_admin' THEN 'Super Administrateur'
        WHEN 'gestionnaire' THEN 'Gestionnaire'
        ELSE 'Utilisateur'
      END;
      user_plan := COALESCE(workspace_rec.plan_type, 'premium');
      user_subscribed := true;
    ELSE
      -- Génération de données fictives cohérentes
      user_email := 'user.' || SUBSTRING(role_rec.user_id::text, 1, 8) || '@' || 
                   LOWER(REPLACE(COALESCE(workspace_rec.name, 'company'), ' ', '')) || '.com';
      
      -- Noms fictifs basés sur l'ID utilisateur
      user_first_name := CASE SUBSTRING(role_rec.user_id::text, 1, 1)
        WHEN '0' THEN 'Alice'
        WHEN '1' THEN 'Bob'
        WHEN '2' THEN 'Claire'
        WHEN '3' THEN 'David'
        WHEN '4' THEN 'Emma'
        WHEN '5' THEN 'François'
        WHEN '6' THEN 'Gabrielle'
        WHEN '7' THEN 'Hugo'
        WHEN '8' THEN 'Isabelle'
        WHEN '9' THEN 'Julien'
        WHEN 'a' THEN 'Kevin'
        WHEN 'b' THEN 'Laura'
        WHEN 'c' THEN 'Marc'
        WHEN 'd' THEN 'Nathalie'
        WHEN 'e' THEN 'Olivier'
        WHEN 'f' THEN 'Patricia'
        ELSE 'Utilisateur'
      END;
      
      user_last_name := CASE SUBSTRING(role_rec.user_id::text, 2, 1)
        WHEN '0' THEN 'Martin'
        WHEN '1' THEN 'Bernard'
        WHEN '2' THEN 'Dubois'
        WHEN '3' THEN 'Thomas'
        WHEN '4' THEN 'Robert'
        WHEN '5' THEN 'Petit'
        WHEN '6' THEN 'Durand'
        WHEN '7' THEN 'Leroy'
        WHEN '8' THEN 'Moreau'
        WHEN '9' THEN 'Simon'
        WHEN 'a' THEN 'Laurent'
        WHEN 'b' THEN 'Lefebvre'
        WHEN 'c' THEN 'Michel'
        WHEN 'd' THEN 'Garcia'
        WHEN 'e' THEN 'David'
        WHEN 'f' THEN 'Roux'
        ELSE 'Doe'
      END;
      
      user_company := COALESCE(workspace_rec.name, 'Entreprise Fictive');
      
      user_position := CASE role_rec.role
        WHEN 'admin' THEN 'Directeur Général'
        WHEN 'supra_admin' THEN 'Super Administrateur'
        WHEN 'gestionnaire' THEN 'Chef de Projet'
        WHEN 'lecteur' THEN 'Analyste'
        ELSE 'Employé'
      END;
      
      user_plan := COALESCE(workspace_rec.plan_type, 'freemium');
      user_subscribed := CASE 
        WHEN role_rec.role = 'supra_admin' THEN true
        WHEN COALESCE(workspace_rec.plan_type, 'freemium') = 'premium' THEN true
        ELSE false
      END;
    END IF;
    
    -- Insérer dans la table users
    INSERT INTO users (
      user_id, 
      workspace_id, 
      first_name, 
      last_name, 
      company, 
      position, 
      phone,
      email, 
      plan_type, 
      subscribed, 
      trial_end, 
      subscription_end,
      assigned_by,
      created_at, 
      updated_at
    ) VALUES (
      role_rec.user_id,
      role_rec.workspace_id,
      user_first_name,
      user_last_name,
      user_company,
      user_position,
      '+33 ' || LPAD((RANDOM() * 900000000 + 100000000)::text, 9, '0'), -- Téléphone fictif français
      user_email,
      user_plan,
      user_subscribed,
      CASE WHEN user_subscribed THEN NULL ELSE (now() + interval '7 days') END,
      CASE WHEN user_subscribed THEN (now() + interval '1 year') ELSE NULL END,
      role_rec.assigned_by,
      role_rec.created_at,
      role_rec.updated_at
    )
    ON CONFLICT (user_id, workspace_id) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      company = EXCLUDED.company,
      position = EXCLUDED.position,
      phone = EXCLUDED.phone,
      email = EXCLUDED.email,
      plan_type = EXCLUDED.plan_type,
      subscribed = EXCLUDED.subscribed,
      trial_end = EXCLUDED.trial_end,
      subscription_end = EXCLUDED.subscription_end,
      updated_at = now();
    
    RAISE NOTICE 'Migrated user % (%) to workspace % with role %', 
      user_first_name || ' ' || user_last_name, 
      user_email, 
      user_company, 
      role_rec.role;
      
  END LOOP;
  
  RAISE NOTICE 'Migration completed. All user_roles entries have been migrated to users table.';
  
END $$;