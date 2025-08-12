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

-- 5. Create workspace_plans view for easy access to workspace subscription info
CREATE OR REPLACE VIEW public.workspace_plans AS
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

-- 6. Create function to get user's workspace plan
CREATE OR REPLACE FUNCTION public.get_user_workspace_plan(user_uuid uuid DEFAULT auth.uid())
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(w.plan_type, 'freemium')
  FROM public.workspaces w
  LEFT JOIN public.user_roles ur ON ur.workspace_id = w.id
  WHERE w.owner_id = user_uuid OR ur.user_id = user_uuid
  ORDER BY 
    CASE WHEN w.owner_id = user_uuid THEN 0 ELSE 1 END,
    CASE w.plan_type 
      WHEN 'premium' THEN 0 
      WHEN 'standard' THEN 1 
      ELSE 2 
    END
  LIMIT 1;
$function$;