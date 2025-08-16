-- DIAGNOSTIC COMPLET DE LA STRUCTURE user_roles

-- 1. Vérifier la structure exacte de la table user_roles
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'user_roles' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Vérifier si la colonne is_supra_admin existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user_roles' 
            AND column_name = 'is_supra_admin'
        ) THEN 'COLONNE is_supra_admin EXISTE ✅'
        ELSE 'COLONNE is_supra_admin MANQUANTE ❌'
    END as colonne_status;

-- 3. Voir toutes les données de user_roles pour votre email
SELECT 
    'DONNEES user_roles' as info,
    ur.*
FROM user_roles ur
JOIN auth.users u ON ur.user_id = u.id
WHERE u.email = 'axelgirard.pro+dev@gmail.com';

-- 4. Voir le code source complet de la fonction is_supra_admin
SELECT prosrc as function_code
FROM pg_proc 
WHERE proname = 'is_supra_admin';

-- 5. Test direct de la requête dans is_supra_admin
SELECT 
    'TEST DIRECT' as test,
    auth.uid() as current_user_id,
    EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() 
        AND ur.is_supra_admin = TRUE
    ) as direct_check;

-- 6. Lister TOUS les utilisateurs avec is_supra_admin
SELECT 
    'TOUS LES SUPRA ADMINS' as info,
    u.email,
    ur.role,
    ur.is_supra_admin
FROM user_roles ur
JOIN auth.users u ON ur.user_id = u.id
WHERE ur.is_supra_admin = TRUE;
