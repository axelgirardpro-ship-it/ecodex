-- Create companies table for multi-tenant support
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  plan_type TEXT DEFAULT 'freemium',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Create user_roles table for role-based access control
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'gestionnaire', 'lecteur')),
  assigned_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create favorites table for user favorites
CREATE TABLE public.favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  item_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);

-- Enable RLS on favorites
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Create datasets table for imported data
CREATE TABLE public.datasets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  status TEXT DEFAULT 'active',
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on datasets
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;

-- Create company_invitations table for team invitations
CREATE TABLE public.company_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'gestionnaire', 'lecteur')),
  invited_by UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (company_id, email)
);

-- Enable RLS on company_invitations
ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for companies
CREATE POLICY "Users can view their own companies" ON public.companies
  FOR SELECT USING (
    owner_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND company_id = companies.id)
  );

CREATE POLICY "Owners can update their companies" ON public.companies
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can create companies" ON public.companies
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Create RLS policies for user_roles
CREATE POLICY "Users can view roles in their companies" ON public.user_roles
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.companies WHERE id = user_roles.company_id AND owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.company_id = user_roles.company_id AND ur.role = 'admin')
  );

CREATE POLICY "Admins can manage user roles" ON public.user_roles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.companies WHERE id = user_roles.company_id AND owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.company_id = user_roles.company_id AND ur.role = 'admin')
  );

-- Create RLS policies for favorites
CREATE POLICY "Users can manage their own favorites" ON public.favorites
  FOR ALL USING (user_id = auth.uid());

-- Create RLS policies for datasets
CREATE POLICY "Users can view datasets in their companies" ON public.datasets
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND company_id = datasets.company_id)
  );

CREATE POLICY "Users can create datasets in their companies" ON public.datasets
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    (company_id IS NULL OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND company_id = datasets.company_id AND role IN ('admin', 'gestionnaire')))
  );

CREATE POLICY "Users can update datasets in their companies" ON public.datasets
  FOR UPDATE USING (
    user_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND company_id = datasets.company_id AND role IN ('admin', 'gestionnaire'))
  );

-- Create RLS policies for company_invitations
CREATE POLICY "Users can view invitations for their companies" ON public.company_invitations
  FOR SELECT USING (
    email = auth.email() OR
    EXISTS (SELECT 1 FROM public.companies WHERE id = company_invitations.company_id AND owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND company_id = company_invitations.company_id AND role = 'admin')
  );

CREATE POLICY "Admins can manage invitations" ON public.company_invitations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.companies WHERE id = company_invitations.company_id AND owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND company_id = company_invitations.company_id AND role = 'admin')
  );

-- Create function to update updated_at columns
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_datasets_updated_at
  BEFORE UPDATE ON public.datasets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update handle_new_user function to create company and assign admin role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  company_id UUID;
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  
  -- Create a company for the new user
  INSERT INTO public.companies (name, owner_id, plan_type)
  VALUES (
    COALESCE(NEW.raw_user_meta_data ->> 'company', 'My Company'),
    NEW.id,
    'freemium'
  ) RETURNING id INTO company_id;
  
  -- Assign admin role to the new user
  INSERT INTO public.user_roles (user_id, company_id, role, assigned_by)
  VALUES (NEW.id, company_id, 'admin', NEW.id);
  
  -- Insert into subscribers with freemium plan
  INSERT INTO public.subscribers (user_id, email, plan_type, trial_end)
  VALUES (
    NEW.id,
    NEW.email,
    'freemium',
    now() + interval '7 days'
  );
  
  -- Insert into search_quotas with freemium limits
  INSERT INTO public.search_quotas (user_id, plan_type)
  VALUES (NEW.id, 'freemium');
  
  RETURN NEW;
END;
$function$;