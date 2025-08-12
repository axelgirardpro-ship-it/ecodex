-- Enable realtime for search_quotas table
ALTER TABLE search_quotas REPLICA IDENTITY FULL;

-- Add search_quotas to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE search_quotas;