-- DIAGNOSTIC COMPLET DES POLITIQUES STORAGE
-- À exécuter dans le SQL Editor de Supabase

-- 1. Vérifier l'existence du bucket imports
SELECT * FROM storage.buckets WHERE id = 'imports';

-- 2. Lister TOUTES les politiques sur storage.objects
SELECT 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
ORDER BY policyname;

-- 3. Vérifier spécifiquement les politiques pour bucket imports
SELECT 
    policyname,
    cmd as operation,
    CASE 
        WHEN qual IS NOT NULL THEN qual 
        WHEN with_check IS NOT NULL THEN with_check
        ELSE 'NO_CONDITION'
    END as condition
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND (qual LIKE '%imports%' OR with_check LIKE '%imports%');

-- 4. Tester la fonction is_supra_admin
SELECT 
    is_supra_admin() as is_current_user_supra_admin,
    auth.uid() as current_user_id;

-- 5. Vérifier les rôles de l'utilisateur courant
SELECT 
    u.email,
    ur.role,
    ur.is_supra_admin,
    w.name as workspace_name
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN workspaces w ON ur.workspace_id = w.id
WHERE u.id = auth.uid();

-- 6. Test direct des politiques storage avec simulation
SELECT 
    'Test politique storage' as test,
    bucket_id = 'imports' AND is_supra_admin() as should_allow_upload
FROM (SELECT 'imports' as bucket_id) t;

-- 7. Vérifier la définition actuelle de is_supra_admin
SELECT 
    proname as function_name,
    prosrc as function_body
FROM pg_proc 
WHERE proname = 'is_supra_admin'
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
