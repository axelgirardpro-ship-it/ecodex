-- Create storage bucket for imports
INSERT INTO storage.buckets (id, name, public) VALUES ('imports', 'imports', false)
ON CONFLICT (id) DO NOTHING;

-- Create policies for imports bucket
CREATE POLICY "Supra admins can upload imports" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'imports' AND is_supra_admin());

CREATE POLICY "Supra admins can read imports" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'imports' AND is_supra_admin());

CREATE POLICY "Supra admins can update imports" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'imports' AND is_supra_admin());

CREATE POLICY "Supra admins can delete imports" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'imports' AND is_supra_admin());
