-- FIX DEFINITIF DU STATUT SUPRA ADMIN POUR axelgirard.pro@gmail.com
-- À exécuter dans le SQL Editor de Supabase

-- 1. Diagnostic de l'état actuel
SELECT 
    'AVANT FIX' as status,
    u.email,
    u.id as user_id,
    ur.role,
    ur.is_supra_admin,
    is_supra_admin() as function_result
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE u.email = 'axelgirard.pro@gmail.com';

-- 2. S'assurer que votre entrée user_roles existe avec is_supra_admin = TRUE
INSERT INTO public.user_roles (user_id, workspace_id, role, assigned_by, is_supra_admin)
SELECT 
    u.id,
    NULL,  -- Global role (no specific workspace)
    'supra_admin',
    u.id,  -- Self-assigned
    TRUE
FROM auth.users u 
WHERE u.email = 'axelgirard.pro@gmail.com'
ON CONFLICT (user_id, COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid))
DO UPDATE SET 
    is_supra_admin = TRUE,
    role = 'supra_admin',
    updated_at = now();

-- 3. Alternative: Mettre à jour toutes les entrées existantes
UPDATE public.user_roles 
SET is_supra_admin = TRUE,
    role = 'supra_admin',
    updated_at = now()
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'axelgirard.pro@gmail.com'
);

-- 4. Vérification après fix
SELECT 
    'APRES FIX' as status,
    u.email,
    u.id as user_id,
    ur.role,
    ur.is_supra_admin,
    is_supra_admin() as function_result
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE u.email = 'axelgirard.pro@gmail.com';

-- 5. Test final de upload simulation
SELECT 
    'TEST UPLOAD' as test,
    bucket_id = 'imports' AND is_supra_admin() as should_work,
    is_supra_admin() as supra_admin_status
FROM (SELECT 'imports' as bucket_id) t;
