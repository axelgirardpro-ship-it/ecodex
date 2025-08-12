-- Supprimer les colonnes liées aux quotas de recherche
ALTER TABLE search_quotas DROP COLUMN IF EXISTS searches_limit;
ALTER TABLE search_quotas DROP COLUMN IF EXISTS searches_used;