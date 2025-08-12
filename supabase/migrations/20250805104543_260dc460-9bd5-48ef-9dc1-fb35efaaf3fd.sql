-- Ajouter la contrainte unique manquante sur la table users
ALTER TABLE public.users ADD CONSTRAINT unique_user_workspace UNIQUE (user_id, workspace_id);

-- Maintenant exécuter la migration des données
SELECT migrate_to_unified_users();

-- Supprimer les colonnes Stripe inutiles
ALTER TABLE public.workspaces DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE public.subscribers DROP COLUMN IF EXISTS stripe_customer_id;