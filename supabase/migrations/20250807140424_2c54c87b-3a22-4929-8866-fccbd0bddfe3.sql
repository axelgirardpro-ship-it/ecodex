-- Create storage bucket for source logos
INSERT INTO storage.buckets (id, name, public) VALUES ('source-logos', 'source-logos', true);

-- Create policies for source logos bucket
CREATE POLICY "Source logos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'source-logos');

CREATE POLICY "Supra admins can upload source logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'source-logos' AND is_supra_admin());

CREATE POLICY "Supra admins can update source logos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'source-logos' AND is_supra_admin());

CREATE POLICY "Supra admins can delete source logos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'source-logos' AND is_supra_admin());