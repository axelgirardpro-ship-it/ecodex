-- Fix inconsistency between frontend (free/paid) and database (standard/premium)
-- This migration aligns the database to use 'free' and 'paid' values

-- Step 1: Drop the existing CHECK constraint
ALTER TABLE public.fe_sources 
DROP CONSTRAINT IF EXISTS fe_sources_access_level_check;

-- Step 2: Update existing values from standard/premium to free/paid
UPDATE public.fe_sources 
SET access_level = CASE 
  WHEN access_level = 'standard' THEN 'free'
  WHEN access_level = 'premium' THEN 'paid'
  ELSE access_level
END
WHERE access_level IN ('standard', 'premium');

-- Step 3: Add new CHECK constraint with correct values
ALTER TABLE public.fe_sources 
ADD CONSTRAINT fe_sources_access_level_check 
CHECK (access_level IN ('free', 'paid'));

-- Step 4: Update default value
ALTER TABLE public.fe_sources 
ALTER COLUMN access_level SET DEFAULT 'free';

-- Step 5: Update the auto_detect_fe_sources function to use 'free' instead of 'standard'
CREATE OR REPLACE FUNCTION public.auto_detect_fe_sources()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert new source if it doesn't exist
  INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
  VALUES (NEW."Source", 'free', true, true)
  ON CONFLICT (source_name) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Step 6: Update RLS policy on emission_factors to use 'free' and 'paid'
DROP POLICY IF EXISTS "Users can view emission factors with 4-tier access" ON public.emission_factors;

CREATE POLICY "Users can view emission factors with 4-tier access"
ON public.emission_factors
FOR SELECT
TO authenticated
USING (
  -- Tier 1: Private workspace emission factors
  (workspace_id IN (
    SELECT w.id
    FROM workspaces w
    LEFT JOIN user_roles ur ON ur.workspace_id = w.id
    WHERE w.owner_id = auth.uid() OR ur.user_id = auth.uid()
  ))
  OR
  -- Tier 2: Global free emission factors
  (workspace_id IS NULL AND "Source" IN (
    SELECT source_name FROM public.fe_sources 
    WHERE is_global = true AND access_level = 'free'
  ))
  OR
  -- Tier 3: Global paid emission factors (for premium users)
  (workspace_id IS NULL AND "Source" IN (
    SELECT source_name FROM public.fe_sources 
    WHERE is_global = true AND access_level = 'paid'
  ) AND get_user_workspace_plan() = 'premium')
  OR
  -- Tier 4: Specifically assigned sources
  ("Source" IN (
    SELECT fsa.source_name
    FROM public.fe_source_workspace_assignments fsa
    WHERE fsa.workspace_id IN (
      SELECT w.id
      FROM workspaces w
      LEFT JOIN user_roles ur ON ur.workspace_id = w.id
      WHERE w.owner_id = auth.uid() OR ur.user_id = auth.uid()
    )
  ))
);

-- Step 7: Add comment for clarity
COMMENT ON COLUMN public.fe_sources.access_level IS 
'Access level for the source: ''free'' for publicly accessible sources, ''paid'' for sources requiring explicit workspace assignment';


