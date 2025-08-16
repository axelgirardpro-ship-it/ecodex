-- FIX DEFINITIF DU STATUT SUPRA ADMIN POUR axelgirard.pro+dev@gmail.com
-- À exécuter dans le SQL Editor de Supabase

-- 1. Diagnostic de l'état actuel pour les deux emails
SELECT 
    'DIAGNOSTIC' as status,
    u.email,
    u.id as user_id,
    ur.role,
    ur.is_supra_admin,
    CASE WHEN u.id = auth.uid() THEN 'CURRENT_USER' ELSE 'OTHER' END as user_type
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE u.email IN ('axelgirard.pro@gmail.com', 'axelgirard.pro+dev@gmail.com')
ORDER BY u.email;

-- 2. Vérifier qui est connecté actuellement
SELECT 
    'CURRENT USER' as info,
    auth.uid() as current_user_id,
    (SELECT email FROM auth.users WHERE id = auth.uid()) as current_email,
    is_supra_admin() as current_supra_admin_status;

-- 3. Assigner le statut supra admin à axelgirard.pro+dev@gmail.com
INSERT INTO public.user_roles (user_id, workspace_id, role, assigned_by, is_supra_admin)
SELECT 
    u.id,
    NULL,  -- Global role (no specific workspace)
    'supra_admin',
    u.id,  -- Self-assigned
    TRUE
FROM auth.users u 
WHERE u.email = 'axelgirard.pro+dev@gmail.com'
ON CONFLICT (user_id, COALESCE(workspace_id, '00000000-0000-0000-0000-000000000000'::uuid))
DO UPDATE SET 
    is_supra_admin = TRUE,
    role = 'supra_admin',
    updated_at = now();

-- 4. Alternative: Mettre à jour toutes les entrées existantes pour +dev
UPDATE public.user_roles 
SET is_supra_admin = TRUE,
    role = 'supra_admin',
    updated_at = now()
WHERE user_id = (
    SELECT id FROM auth.users WHERE email = 'axelgirard.pro+dev@gmail.com'
);

-- 5. Vérification finale
SELECT 
    'VERIFICATION FINALE' as status,
    u.email,
    u.id as user_id,
    ur.role,
    ur.is_supra_admin,
    CASE WHEN u.id = auth.uid() THEN 'CURRENT_USER ✅' ELSE 'OTHER' END as user_type
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE u.email IN ('axelgirard.pro@gmail.com', 'axelgirard.pro+dev@gmail.com')
ORDER BY u.email;

-- 6. Test final pour utilisateur actuel
SELECT 
    'TEST FINAL' as test,
    is_supra_admin() as supra_admin_status,
    bucket_id = 'imports' AND is_supra_admin() as upload_should_work
FROM (SELECT 'imports' as bucket_id) t;
