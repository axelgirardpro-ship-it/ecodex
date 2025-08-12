-- Create a table for global user roles (not tied to specific workspaces)
CREATE TABLE public.global_user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('supra_admin')),
  assigned_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable Row Level Security
ALTER TABLE public.global_user_roles ENABLE ROW LEVEL SECURITY;

-- Create policy for supra admins to manage global roles
CREATE POLICY "Supra admins can manage global roles" 
ON public.global_user_roles 
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.global_user_roles 
    WHERE user_id = auth.uid() AND role = 'supra_admin'
  )
);

-- Create policy for users to view their own global role
CREATE POLICY "Users can view their own global role" 
ON public.global_user_roles 
FOR SELECT 
USING (user_id = auth.uid());

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_global_user_roles_updated_at
BEFORE UPDATE ON public.global_user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to check if user is supra admin
CREATE OR REPLACE FUNCTION public.is_supra_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.global_user_roles 
    WHERE user_id = user_uuid AND role = 'supra_admin'
  );
$$;