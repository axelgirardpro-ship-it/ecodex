-- Drop the redundant database_plan_access table
DROP TABLE IF EXISTS public.database_plan_access;

-- Update existing emission_factors to standardize plan_tier
UPDATE public.emission_factors 
SET plan_tier = 'standard' 
WHERE plan_tier = 'freemium' OR plan_tier IS NULL;

-- Create a constraint to only allow 'standard' and 'premium' plan tiers
ALTER TABLE public.emission_factors 
DROP CONSTRAINT IF EXISTS emission_factors_plan_tier_check;

ALTER TABLE public.emission_factors 
ADD CONSTRAINT emission_factors_plan_tier_check 
CHECK (plan_tier IN ('standard', 'premium'));

-- Update the default value for new records
ALTER TABLE public.emission_factors 
ALTER COLUMN plan_tier SET DEFAULT 'standard';

-- Create function to get accessible plan tiers based on user subscription
CREATE OR REPLACE FUNCTION get_accessible_plan_tiers(user_plan text)
RETURNS text[]
LANGUAGE sql
STABLE
AS $$
  SELECT CASE 
    WHEN user_plan = 'premium' THEN ARRAY['standard', 'premium']
    ELSE ARRAY['standard']
  END;
$$;