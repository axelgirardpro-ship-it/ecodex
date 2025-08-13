-- One-time rebuild of public projection after function change
DO $$ BEGIN
  PERFORM public.rebuild_emission_factors_public_search_fr();
END $$;


