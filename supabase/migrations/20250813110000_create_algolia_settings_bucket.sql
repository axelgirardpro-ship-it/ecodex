-- Ensure bucket algolia_settings exists for Algolia settings JSON files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'algolia_settings'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('algolia_settings', 'algolia_settings', false, 1048576, ARRAY['application/json']);
  END IF;
END $$;


