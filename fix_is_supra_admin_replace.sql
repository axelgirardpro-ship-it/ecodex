-- FIX DE LA FONCTION is_supra_admin AVEC CREATE OR REPLACE

-- 1. Vérifier le problème actuel
SELECT 
    'PROBLEME ACTUEL' as status,
    auth.uid() as user_id,
    (SELECT email FROM auth.users WHERE id = auth.uid()) as email,
    is_supra_admin() as function_result,
    EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.is_supra_admin = true
    ) as direct_query_result;

-- 2. Voir l'ancienne définition de la fonction
SELECT prosrc as old_function_code
FROM pg_proc 
WHERE proname = 'is_supra_admin';

-- 3. Recréer la fonction avec CREATE OR REPLACE (sans DROP)
CREATE OR REPLACE FUNCTION public.is_supra_admin(user_uuid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles ur
    WHERE ur.user_id = COALESCE(user_uuid, auth.uid())
    AND ur.is_supra_admin = true
  );
$$;

-- 4. Tester la fonction corrigée
SELECT 
    'APRES FIX' as status,
    auth.uid() as user_id,
    (SELECT email FROM auth.users WHERE id = auth.uid()) as email,
    is_supra_admin() as function_result,
    EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.is_supra_admin = true
    ) as direct_query_result;

-- 5. Test final pour upload
SELECT 
    'TEST UPLOAD FINAL' as test,
    is_supra_admin() as supra_admin_status,
    bucket_id = 'imports' AND is_supra_admin() as should_work
FROM (SELECT 'imports' as bucket_id) t;
