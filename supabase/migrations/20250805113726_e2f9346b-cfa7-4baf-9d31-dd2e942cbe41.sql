-- Activer RLS et créer les politiques pour la table users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Politique pour que les utilisateurs voient leurs propres données
CREATE POLICY "Users can view their own data" 
ON public.users 
FOR SELECT 
USING (user_id = auth.uid());

-- Politique pour que les admins voient les données de leur workspace
CREATE POLICY "Admins can view workspace users" 
ON public.users 
FOR SELECT 
USING (workspace_id IN (
  SELECT ur.workspace_id 
  FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role IN ('admin', 'supra_admin')
));

-- Politique pour que les utilisateurs puissent mettre à jour leurs propres données
CREATE POLICY "Users can update their own data" 
ON public.users 
FOR UPDATE 
USING (user_id = auth.uid());

-- Politique pour que les admins puissent insérer des utilisateurs dans leur workspace
CREATE POLICY "Admins can insert users in their workspace" 
ON public.users 
FOR INSERT 
WITH CHECK (workspace_id IN (
  SELECT ur.workspace_id 
  FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role IN ('admin', 'supra_admin')
));