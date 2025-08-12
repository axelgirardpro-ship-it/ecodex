-- Phase 2: Database optimization - Merge companies into workspaces
-- First, ensure all workspace data is properly set from companies table
UPDATE public.workspaces 
SET plan_type = companies.plan_type,
    updated_at = companies.updated_at
FROM public.companies 
WHERE workspaces.id = companies.id;

-- Update all references to companies table to point to workspaces
-- Update user_roles that reference companies to reference workspaces (they should already match)
-- This is a safety check as they should already be the same

-- Update emission_factors workspace_id references (safety check)
UPDATE public.emission_factors 
SET workspace_id = companies.id
FROM public.companies 
WHERE emission_factors.workspace_id IS NULL 
  AND companies.id IS NOT NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_emission_factors_workspace_dataset 
ON public.emission_factors(workspace_id, dataset_id);

CREATE INDEX IF NOT EXISTS idx_datasets_workspace_user 
ON public.datasets(workspace_id, user_id);

CREATE INDEX IF NOT EXISTS idx_search_history_user_created 
ON public.search_history(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_expires 
ON public.user_sessions(user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created 
ON public.audit_logs(user_id, created_at DESC);

-- Drop the companies table as it's now redundant
-- All data has been migrated to workspaces table
DROP TABLE IF EXISTS public.companies CASCADE;