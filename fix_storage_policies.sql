-- FIX DEFINITIF DES POLITIQUES STORAGE POUR BUCKET IMPORTS
-- À exécuter dans le SQL Editor de Supabase après diagnostic

-- 1. Supprimer toutes les politiques existantes pour imports (cleanup)
DROP POLICY IF EXISTS "Supra admins can upload imports" ON storage.objects;
DROP POLICY IF EXISTS "Supra admins can read imports" ON storage.objects;
DROP POLICY IF EXISTS "Supra admins can update imports" ON storage.objects;
DROP POLICY IF EXISTS "Supra admins can delete imports" ON storage.objects;

-- 2. Créer le bucket s'il n'existe pas
INSERT INTO storage.buckets (id, name, public) 
VALUES ('imports', 'imports', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Créer les politiques avec noms uniques et conditions strictes
CREATE POLICY "imports_upload_policy" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
    bucket_id = 'imports' 
    AND is_supra_admin()
);

CREATE POLICY "imports_read_policy" 
ON storage.objects 
FOR SELECT 
USING (
    bucket_id = 'imports' 
    AND is_supra_admin()
);

CREATE POLICY "imports_update_policy" 
ON storage.objects 
FOR UPDATE 
USING (
    bucket_id = 'imports' 
    AND is_supra_admin()
);

CREATE POLICY "imports_delete_policy" 
ON storage.objects 
FOR DELETE 
USING (
    bucket_id = 'imports' 
    AND is_supra_admin()
);

-- 4. Vérification finale
SELECT 
    'Politiques créées' as status,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename = 'objects' 
AND schemaname = 'storage'
AND (qual LIKE '%imports%' OR with_check LIKE '%imports%');

-- 5. Test de la configuration
SELECT 
    'Test final' as test,
    bucket_id = 'imports' AND is_supra_admin() as upload_should_work
FROM (SELECT 'imports' as bucket_id) t;
