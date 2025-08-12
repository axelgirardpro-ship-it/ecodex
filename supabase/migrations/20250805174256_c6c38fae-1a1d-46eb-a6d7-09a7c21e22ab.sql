-- Add unique constraint on user_id to search_quotas table
-- This will prevent duplicate entries for the same user
ALTER TABLE public.search_quotas 
ADD CONSTRAINT search_quotas_user_id_unique UNIQUE (user_id);