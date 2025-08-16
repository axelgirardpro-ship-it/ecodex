-- FIX DIRECT DES POLITIQUES STORAGE SANS is_supra_admin()

-- 1. Voir votre user_id actuel
SELECT 
    'VOTRE USER ID' as info,
    auth.uid() as user_id,
    (SELECT email FROM auth.users WHERE id = auth.uid()) as email;

-- 2. Supprimer les anciennes politiques imports
DROP POLICY IF EXISTS "Supra admins can insert into imports" ON storage.objects;
DROP POLICY IF EXISTS "Supra admins can select from imports" ON storage.objects;
DROP POLICY IF EXISTS "Supra admins can update imports" ON storage.objects;
DROP POLICY IF EXISTS "Supra admins can delete from imports" ON storage.objects;

-- 3. Créer des politiques temporaires avec logique directe
CREATE POLICY "imports_upload_direct" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
    bucket_id = 'imports' 
    AND EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.is_supra_admin = true
    )
);

CREATE POLICY "imports_read_direct" 
ON storage.objects 
FOR SELECT 
USING (
    bucket_id = 'imports' 
    AND EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.is_supra_admin = true
    )
);

CREATE POLICY "imports_update_direct" 
ON storage.objects 
FOR UPDATE 
USING (
    bucket_id = 'imports' 
    AND EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.is_supra_admin = true
    )
);

CREATE POLICY "imports_delete_direct" 
ON storage.objects 
FOR DELETE 
USING (
    bucket_id = 'imports' 
    AND EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.is_supra_admin = true
    )
);

-- 4. Test de la nouvelle logique
SELECT 
    'TEST DIRECT POLICY' as test,
    auth.uid() as user_id,
    EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.is_supra_admin = true
    ) as direct_policy_check,
    bucket_id = 'imports' AND EXISTS (
        SELECT 1 FROM user_roles ur 
        WHERE ur.user_id = auth.uid() 
        AND ur.is_supra_admin = true
    ) as upload_should_work
FROM (SELECT 'imports' as bucket_id) t;
