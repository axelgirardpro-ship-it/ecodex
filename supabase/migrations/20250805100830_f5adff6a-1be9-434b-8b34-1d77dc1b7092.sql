-- 1. Remove billing columns from profiles table
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS billing_address,
DROP COLUMN IF EXISTS billing_postal_code,
DROP COLUMN IF EXISTS billing_country,
DROP COLUMN IF EXISTS billing_company,
DROP COLUMN IF EXISTS billing_vat_number,
DROP COLUMN IF EXISTS billing_siren;

-- 2. Add billing columns to workspaces table (most already exist)
ALTER TABLE public.workspaces 
ADD COLUMN IF NOT EXISTS stripe_customer_id text,
ADD COLUMN IF NOT EXISTS subscription_tier text;

-- 3. Adapt subscribers table to reference workspaces
ALTER TABLE public.subscribers 
ADD COLUMN IF NOT EXISTS workspace_id uuid;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_subscribers_workspace_id ON public.subscribers(workspace_id);

-- 4. Update RLS policies for subscribers to be workspace-level
DROP POLICY IF EXISTS "Users can view their workspace subscription" ON public.subscribers;
DROP POLICY IF EXISTS "System can manage workspace subscriptions" ON public.subscribers;

CREATE POLICY "Users can view their workspace subscription" 
ON public.subscribers 
FOR SELECT 
USING (workspace_id IN (
  SELECT w.id 
  FROM workspaces w 
  LEFT JOIN user_roles ur ON ur.workspace_id = w.id 
  WHERE w.owner_id = auth.uid() OR ur.user_id = auth.uid()
));

CREATE POLICY "System can manage workspace subscriptions" 
ON public.subscribers 
FOR ALL 
USING (true);

-- 5. Drop and recreate workspace_plans view
DROP VIEW IF EXISTS public.workspace_plans;

CREATE VIEW public.workspace_plans AS
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  w.owner_id,
  w.plan_type,
  s.subscribed,
  s.subscription_tier,
  s.subscription_end,
  s.trial_end
FROM public.workspaces w
LEFT JOIN public.subscribers s ON s.workspace_id = w.id;

-- Enable RLS on the view (security invoker by default)
ALTER VIEW public.workspace_plans SET (security_invoker = on);