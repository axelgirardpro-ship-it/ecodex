-- Cleanup obsolete projections and legacy tables after migration to single index (ef_all)
-- This migration is idempotent and safe to run multiple times.

-- Drop obsolete projection functions if they still exist
DROP FUNCTION IF EXISTS public.rebuild_emission_factors_public_search_fr() CASCADE;
DROP FUNCTION IF EXISTS public.rebuild_emission_factors_private_search_fr() CASCADE;

-- Drop obsolete projection tables if they still exist
DROP TABLE IF EXISTS public.emission_factors_public_search_fr CASCADE;
DROP TABLE IF EXISTS public.emission_factors_private_search_fr CASCADE;

-- Drop legacy invitations/companies tables if still present
DROP TABLE IF EXISTS public.company_invitations CASCADE;
DROP TABLE IF EXISTS public.companies CASCADE;


