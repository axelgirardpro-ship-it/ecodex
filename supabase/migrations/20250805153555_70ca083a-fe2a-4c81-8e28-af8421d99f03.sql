-- Verify and fix RLS policy for emission_factors
-- The current policy might be too restrictive

-- Let's check what sources we have and ensure they are properly configured
INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
SELECT DISTINCT "Source", 'standard', true, true
FROM public.emission_factors
WHERE "Source" NOT IN (SELECT source_name FROM public.fe_sources)
ON CONFLICT (source_name) DO NOTHING;

-- Make sure the user can access the current workspace data
-- Let's also ensure there are no workspace restrictions preventing access to global data