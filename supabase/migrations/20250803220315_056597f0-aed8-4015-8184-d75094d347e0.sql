-- Fix the function search path security issue
CREATE OR REPLACE FUNCTION get_accessible_plan_tiers(user_plan text)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE 
    WHEN user_plan = 'premium' THEN ARRAY['standard', 'premium']
    ELSE ARRAY['standard']
  END;
$$;