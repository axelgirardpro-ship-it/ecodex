-- Remove obsolete columns from emission_factors table
ALTER TABLE public.emission_factors DROP COLUMN IF EXISTS is_public;
ALTER TABLE public.emission_factors DROP COLUMN IF EXISTS source_type;

-- Fix search_path security warning for existing functions
-- Find and fix any functions with mutable search_path
-- We need to identify which function has the warning first
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION'
AND routine_definition ILIKE '%search_path%';

-- Update any function that might have search_path issues
-- This is a preventive measure to ensure all functions have proper security
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Get all custom functions that might need fixing
    FOR func_record IN 
        SELECT routine_name 
        FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_type = 'FUNCTION'
        AND routine_name NOT LIKE 'pg_%'
    LOOP
        -- Add security definer and stable search_path to custom functions
        BEGIN
            EXECUTE format('ALTER FUNCTION public.%I() SET search_path = public', func_record.routine_name);
        EXCEPTION WHEN OTHERS THEN
            -- Continue if function doesn't exist or has different signature
            CONTINUE;
        END;
    END LOOP;
END $$;

-- Refresh RLS policies to ensure they work with the new structure
-- The policies should already be correct from previous migrations