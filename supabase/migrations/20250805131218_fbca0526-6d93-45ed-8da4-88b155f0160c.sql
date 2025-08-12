-- Fix security warnings by setting search_path for functions

-- Update the auto-detect function with proper search_path
CREATE OR REPLACE FUNCTION public.auto_detect_fe_sources()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert new source if it doesn't exist
  INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
  VALUES (NEW."Source", 'standard', true, true)
  ON CONFLICT (source_name) DO NOTHING;
  
  RETURN NEW;
END;
$$;