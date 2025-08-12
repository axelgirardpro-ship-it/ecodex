-- Migration pour restructurer les données utilisateur - Partie 1
-- Supprimer d'abord les politiques RLS qui dépendent de la colonne role

-- 1. Supprimer les politiques RLS existantes qui utilisent la colonne role
DROP POLICY IF EXISTS "Admins can manage users in their workspace" ON public.users;
DROP POLICY IF EXISTS "Supra admins can manage all users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can view users in their workspace" ON public.users;

-- 2. Maintenant supprimer la colonne role
ALTER TABLE public.users DROP COLUMN IF EXISTS role;

-- 3. Recréer la table users avec la nouvelle structure
DROP TABLE IF EXISTS public.users_new;
CREATE TABLE public.users_new (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  workspace_id uuid NOT NULL,
  first_name text,
  last_name text,
  company text,
  position text,
  phone text,
  email text NOT NULL,
  plan_type text NOT NULL DEFAULT 'freemium',
  subscribed boolean DEFAULT false,
  subscription_tier text,
  trial_end timestamp with time zone,
  subscription_end timestamp with time zone,
  assigned_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, workspace_id)
);

-- 4. Migrer les données
INSERT INTO public.users_new (
  user_id, workspace_id, first_name, last_name, company, position, phone,
  email, plan_type, subscribed, subscription_tier, trial_end, subscription_end,
  assigned_by, created_at, updated_at
)
SELECT DISTINCT
  ur.user_id,
  ur.workspace_id,
  COALESCE(p.first_name, ''),
  COALESCE(p.last_name, ''),
  COALESCE(p.company, w.name),
  COALESCE(p.position, ''),
  COALESCE(p.phone, ''),
  COALESCE(s.email, ''),
  COALESCE(w.plan_type, 'freemium'),
  COALESCE(s.subscribed, false),
  w.subscription_tier,
  s.trial_end,
  s.subscription_end,
  ur.assigned_by,
  LEAST(ur.created_at, COALESCE(p.created_at, ur.created_at), COALESCE(s.created_at, ur.created_at)),
  GREATEST(ur.updated_at, COALESCE(p.updated_at, ur.updated_at), COALESCE(s.updated_at, ur.updated_at))
FROM public.user_roles ur
LEFT JOIN public.profiles p ON p.user_id = ur.user_id AND p.workspace_id = ur.workspace_id
LEFT JOIN public.subscribers s ON s.user_id = ur.user_id AND s.workspace_id = ur.workspace_id
LEFT JOIN public.workspaces w ON w.id = ur.workspace_id
WHERE ur.workspace_id IS NOT NULL;