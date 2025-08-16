-- DIAGNOSTIC DU PROBLÈME D'AUTHENTIFICATION

-- 1. Vérifier l'état de l'authentification
SELECT 
    'AUTH STATUS' as info,
    auth.uid() as auth_uid,
    auth.jwt() as auth_jwt_info,
    auth.role() as auth_role;

-- 2. Vérifier si la session est valide
SELECT 
    'SESSION INFO' as info,
    current_user as current_db_user,
    session_user as session_db_user,
    current_setting('request.jwt.claims', true) as jwt_claims;

-- 3. Chercher tous les utilisateurs avec votre email
SELECT 
    'USER SEARCH' as info,
    u.id,
    u.email,
    u.created_at,
    u.email_confirmed_at,
    u.last_sign_in_at
FROM auth.users u 
WHERE u.email LIKE '%axelgirard.pro%'
ORDER BY u.created_at DESC;

-- 4. Test : forcer un user_id spécifique pour voir si les politiques marchent
SELECT 
    'TEST AVEC USER ID FORCE' as test,
    u.id as forced_user_id,
    u.email,
    EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = u.id 
        AND ur.is_supra_admin = true
    ) as should_work_with_this_user
FROM auth.users u 
WHERE u.email = 'axelgirard.pro+dev@gmail.com';

-- 5. Vérifier les permissions RLS en cours
SELECT 
    'RLS STATUS' as info,
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname IN ('public', 'storage')
AND tablename IN ('user_roles', 'objects');
