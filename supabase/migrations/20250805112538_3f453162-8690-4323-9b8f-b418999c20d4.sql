-- Migration to merge subscription_tier into plan_type and remove redundancy

-- First, update workspaces table where subscription_tier has value but plan_type doesn't match
UPDATE public.workspaces 
SET plan_type = subscription_tier 
WHERE subscription_tier IS NOT NULL 
  AND (plan_type IS NULL OR plan_type = 'freemium')
  AND subscription_tier IN ('standard', 'premium');

-- Update users table where subscription_tier has value but plan_type doesn't match
UPDATE public.users 
SET plan_type = subscription_tier 
WHERE subscription_tier IS NOT NULL 
  AND (plan_type IS NULL OR plan_type = 'freemium')
  AND subscription_tier IN ('standard', 'premium');

-- Now drop the subscription_tier columns from both tables
ALTER TABLE public.workspaces DROP COLUMN IF EXISTS subscription_tier;
ALTER TABLE public.users DROP COLUMN IF EXISTS subscription_tier;