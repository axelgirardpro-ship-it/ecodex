-- Migration pour simplifier l'architecture - Partie 1: Mise à jour des contraintes

-- 1. Supprimer l'ancienne contrainte de rôle sur user_roles
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;

-- 2. Ajouter une nouvelle contrainte qui inclut supra_admin
ALTER TABLE public.user_roles 
ADD CONSTRAINT user_roles_role_check 
CHECK (role IN ('admin', 'gestionnaire', 'lecteur', 'supra_admin'));

-- 3. Ajouter workspace_id à la table profiles si elle n'existe pas déjà
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'profiles' AND column_name = 'workspace_id') THEN
        ALTER TABLE public.profiles ADD COLUMN workspace_id UUID;
    END IF;
END $$;

-- 4. Populer workspace_id dans profiles depuis user_roles
UPDATE public.profiles 
SET workspace_id = (
  SELECT ur.company_id 
  FROM public.user_roles ur 
  WHERE ur.user_id = profiles.user_id 
  LIMIT 1
)
WHERE workspace_id IS NULL;

-- 5. Rendre workspace_id obligatoire dans profiles
ALTER TABLE public.profiles 
ALTER COLUMN workspace_id SET NOT NULL;

-- 6. Ajouter une contrainte de clé étrangère si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'fk_profiles_workspace') THEN
        ALTER TABLE public.profiles 
        ADD CONSTRAINT fk_profiles_workspace 
        FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;