-- Create search_history table to track all user searches
CREATE TABLE public.search_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID,
  search_query TEXT NOT NULL,
  search_filters JSONB,
  results_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on search_history
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;

-- Create policies for search_history
CREATE POLICY "Users can insert their own search history" 
ON public.search_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own search history" 
ON public.search_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Supra admins can view all search history" 
ON public.search_history 
FOR SELECT 
USING (is_supra_admin());

-- Create data_imports table for CSV import history
CREATE TABLE public.data_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  imported_by UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  records_processed INTEGER DEFAULT 0,
  records_inserted INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'processing',
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on data_imports
ALTER TABLE public.data_imports ENABLE ROW LEVEL SECURITY;

-- Create policies for data_imports
CREATE POLICY "Supra admins can manage data imports" 
ON public.data_imports 
FOR ALL 
USING (is_supra_admin());

-- Assign supra admin role to axelgirard.pro@gmail.com
INSERT INTO public.global_user_roles (user_id, role, assigned_by)
SELECT 
  auth.users.id,
  'supra_admin',
  auth.users.id
FROM auth.users 
WHERE auth.users.email = 'axelgirard.pro@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Populate database_plan_access with default rules
INSERT INTO public.database_plan_access (database_name, plan_tier, accessible, created_by) VALUES
('Base Impacts 3.0', 'freemium', true, (SELECT id FROM auth.users WHERE email = 'axelgirard.pro@gmail.com' LIMIT 1)),
('Base Impacts 3.0', 'standard', true, (SELECT id FROM auth.users WHERE email = 'axelgirard.pro@gmail.com' LIMIT 1)),
('Base Impacts 3.0', 'premium', true, (SELECT id FROM auth.users WHERE email = 'axelgirard.pro@gmail.com' LIMIT 1)),
('ADEME Carbon Database', 'freemium', false, (SELECT id FROM auth.users WHERE email = 'axelgirard.pro@gmail.com' LIMIT 1)),
('ADEME Carbon Database', 'standard', true, (SELECT id FROM auth.users WHERE email = 'axelgirard.pro@gmail.com' LIMIT 1)),
('ADEME Carbon Database', 'premium', true, (SELECT id FROM auth.users WHERE email = 'axelgirard.pro@gmail.com' LIMIT 1)),
('DEFRA', 'freemium', false, (SELECT id FROM auth.users WHERE email = 'axelgirard.pro@gmail.com' LIMIT 1)),
('DEFRA', 'standard', false, (SELECT id FROM auth.users WHERE email = 'axelgirard.pro@gmail.com' LIMIT 1)),
('DEFRA', 'premium', true, (SELECT id FROM auth.users WHERE email = 'axelgirard.pro@gmail.com' LIMIT 1))
ON CONFLICT DO NOTHING;