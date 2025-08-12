-- Phase 1: Create FE Source Management Tables

-- Create fe_sources table to manage source metadata
CREATE TABLE public.fe_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_name TEXT NOT NULL UNIQUE,
  access_level TEXT NOT NULL DEFAULT 'standard' CHECK (access_level IN ('standard', 'premium')),
  is_global BOOLEAN NOT NULL DEFAULT true,
  auto_detected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create fe_source_workspace_assignments table for many-to-many relationship
CREATE TABLE public.fe_source_workspace_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_name TEXT NOT NULL,
  workspace_id UUID NOT NULL,
  assigned_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(source_name, workspace_id)
);

-- Enable RLS on both tables
ALTER TABLE public.fe_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fe_source_workspace_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for fe_sources
CREATE POLICY "Supra admins can manage fe_sources"
ON public.fe_sources
FOR ALL
USING (is_supra_admin());

CREATE POLICY "All authenticated users can view fe_sources"
ON public.fe_sources
FOR SELECT
TO authenticated
USING (true);

-- RLS policies for fe_source_workspace_assignments
CREATE POLICY "Supra admins can manage assignments"
ON public.fe_source_workspace_assignments
FOR ALL
USING (is_supra_admin());

CREATE POLICY "Users can view assignments in their workspace"
ON public.fe_source_workspace_assignments
FOR SELECT
TO authenticated
USING (
  workspace_id IN (
    SELECT w.id
    FROM workspaces w
    LEFT JOIN user_roles ur ON ur.workspace_id = w.id
    WHERE w.owner_id = auth.uid() OR ur.user_id = auth.uid()
  )
);

-- Add update trigger for fe_sources
CREATE TRIGGER update_fe_sources_updated_at
BEFORE UPDATE ON public.fe_sources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Populate fe_sources with existing sources from emission_factors
INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
SELECT DISTINCT 
  "Source" as source_name,
  'standard' as access_level,  -- Set as standard by default
  true as is_global,
  true as auto_detected  -- Mark existing sources as auto-detected
FROM public.emission_factors
WHERE "Source" IS NOT NULL
ON CONFLICT (source_name) DO NOTHING;

-- Set "Axel" and "Guillaume" as public global sources as requested
UPDATE public.fe_sources 
SET access_level = 'standard', is_global = true, auto_detected = false
WHERE source_name IN ('Axel', 'Guillaume');

-- Create assignment for "Titanium" from "Axel" source to specific workspace
-- First, we need to find the "Titanium" FE and create specific assignment
INSERT INTO public.fe_source_workspace_assignments (source_name, workspace_id, assigned_by)
SELECT 'Axel', '0503fb36-34bc-4284-8aec-97a942cc0d21'::uuid, auth.uid()
WHERE EXISTS (
  SELECT 1 FROM public.emission_factors 
  WHERE "Source" = 'Axel' AND "Nom" ILIKE '%Titanium%'
);

-- Create function to auto-detect new sources
CREATE OR REPLACE FUNCTION public.auto_detect_fe_sources()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert new source if it doesn't exist
  INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
  VALUES (NEW."Source", 'standard', true, true)
  ON CONFLICT (source_name) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for auto-detection
CREATE TRIGGER auto_detect_sources_trigger
AFTER INSERT ON public.emission_factors
FOR EACH ROW
WHEN (NEW."Source" IS NOT NULL)
EXECUTE FUNCTION public.auto_detect_fe_sources();

-- Update the emission_factors RLS policy for new 4-tier access logic
DROP POLICY IF EXISTS "Users can view emission factors" ON public.emission_factors;

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
  -- Tier 2: Global public emission factors
  (workspace_id IS NULL AND "Source" IN (
    SELECT source_name FROM public.fe_sources 
    WHERE is_global = true AND access_level = 'standard'
  ))
  OR
  -- Tier 3: Global premium emission factors (for premium users)
  (workspace_id IS NULL AND "Source" IN (
    SELECT source_name FROM public.fe_sources 
    WHERE is_global = true AND access_level = 'premium'
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

-- Remove redundant columns (is_public, source_type) - we'll do this after frontend is updated
-- ALTER TABLE public.emission_factors DROP COLUMN IF EXISTS is_public;
-- ALTER TABLE public.emission_factors DROP COLUMN IF EXISTS source_type;