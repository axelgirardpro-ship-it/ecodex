-- Fix the titanium record to be public since it has null workspace_id
UPDATE public.emission_factors 
SET is_public = true 
WHERE workspace_id IS NULL;

-- Add source_type column to emission_factors for better data categorization
ALTER TABLE public.emission_factors 
ADD COLUMN IF NOT EXISTS source_type text DEFAULT 'public';

-- Update existing records to have proper source_type
UPDATE public.emission_factors 
SET source_type = CASE 
  WHEN workspace_id IS NULL AND is_public = true THEN 'public'
  WHEN workspace_id IS NOT NULL AND is_public = false THEN 'workspace'
  ELSE 'public'
END;

-- Update RLS policies to be more permissive for public data
DROP POLICY IF EXISTS "Users can view emission factors in their workspace" ON public.emission_factors;

CREATE POLICY "Users can view emission factors" 
ON public.emission_factors 
FOR SELECT 
USING (
  -- Public data is visible to everyone
  is_public = true 
  OR 
  -- Workspace data is visible to workspace members
  (workspace_id IN (
    SELECT w.id
    FROM workspaces w
    LEFT JOIN user_roles ur ON ur.company_id = w.id
    WHERE w.owner_id = auth.uid() OR ur.user_id = auth.uid()
  ))
);