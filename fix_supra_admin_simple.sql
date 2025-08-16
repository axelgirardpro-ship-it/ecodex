-- FIX SIMPLE DU STATUT SUPRA ADMIN POUR axelgirard.pro+dev@gmail.com

-- 1. Vérifier l'état actuel
SELECT 
    'AVANT FIX' as status,
    u.email,
    u.id as user_id,
    is_supra_admin() as function_result
FROM auth.users u
WHERE u.email = 'axelgirard.pro+dev@gmail.com';

-- 2. Supprimer toutes les entrées existantes pour cet utilisateur
DELETE FROM public.user_roles 
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'axelgirard.pro+dev@gmail.com'
);

-- 3. Créer une nouvelle entrée avec is_supra_admin = TRUE
INSERT INTO public.user_roles (user_id, workspace_id, role, assigned_by, is_supra_admin)
SELECT 
    u.id,
    NULL,
    'supra_admin',
    u.id,
    TRUE
FROM auth.users u 
WHERE u.email = 'axelgirard.pro+dev@gmail.com';

-- 4. Vérification finale
SELECT 
    'APRES FIX' as status,
    u.email,
    u.id as user_id,
    ur.role,
    ur.is_supra_admin,
    is_supra_admin() as function_result
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE u.email = 'axelgirard.pro+dev@gmail.com';

-- 5. Test final
SELECT 
    'TEST UPLOAD' as test,
    is_supra_admin() as supra_admin_status,
    bucket_id = 'imports' AND is_supra_admin() as should_work
FROM (SELECT 'imports' as bucket_id) t;
