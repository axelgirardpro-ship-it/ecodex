-- Vérifier d'abord la structure existante et nettoyer
TRUNCATE TABLE public.users CASCADE;

-- Supprimer la contrainte user_id unique car on veut permettre plusieurs workspace par user
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_user_id_key;

-- Exécuter la migration des données
SELECT migrate_to_unified_users();

-- Phase 3: Maintenant que les données sont migrées, on peut refactoriser le code
-- Supprimer les colonnes Stripe inutiles des autres tables
ALTER TABLE public.workspaces DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE public.subscribers DROP COLUMN IF EXISTS stripe_customer_id;