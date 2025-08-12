-- Phase 2: Exécuter la migration des données
SELECT migrate_to_unified_users();

-- Après migration, supprimer les colonnes Stripe inutiles des tables existantes
ALTER TABLE public.workspaces DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE public.subscribers DROP COLUMN IF EXISTS stripe_customer_id;