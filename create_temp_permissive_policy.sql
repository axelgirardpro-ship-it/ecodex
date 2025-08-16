-- POLITIQUE TEMPORAIRE PERMISSIVE POUR TESTER L'UPLOAD

-- 1. Supprimer toutes les politiques restrictives actuelles
DROP POLICY IF EXISTS "imports_upload_direct" ON storage.objects;
DROP POLICY IF EXISTS "imports_read_direct" ON storage.objects;
DROP POLICY IF EXISTS "imports_update_direct" ON storage.objects;
DROP POLICY IF EXISTS "imports_delete_direct" ON storage.objects;

-- Supprimer aussi les anciennes si elles existent encore
DROP POLICY IF EXISTS "Supra admins can insert into imports" ON storage.objects;
DROP POLICY IF EXISTS "Supra admins can select from imports" ON storage.objects;
DROP POLICY IF EXISTS "Supra admins can update imports" ON storage.objects;
DROP POLICY IF EXISTS "Supra admins can delete from imports" ON storage.objects;

-- 2. Créer des politiques temporaires PERMISSIVES pour tous les utilisateurs authentifiés
CREATE POLICY "imports_upload_temp_permissive" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
    bucket_id = 'imports' 
    AND auth.uid() IS NOT NULL  -- Juste vérifier qu'on est authentifié
);

CREATE POLICY "imports_read_temp_permissive" 
ON storage.objects 
FOR SELECT 
USING (
    bucket_id = 'imports' 
    AND auth.uid() IS NOT NULL
);

CREATE POLICY "imports_update_temp_permissive" 
ON storage.objects 
FOR UPDATE 
USING (
    bucket_id = 'imports' 
    AND auth.uid() IS NOT NULL
);

CREATE POLICY "imports_delete_temp_permissive" 
ON storage.objects 
FOR DELETE 
USING (
    bucket_id = 'imports' 
    AND auth.uid() IS NOT NULL
);

-- 3. Confirmation
SELECT 
    'POLITIQUES PERMISSIVES CREEES' as status,
    'Maintenant testez upload depuis /admin' as instruction;
