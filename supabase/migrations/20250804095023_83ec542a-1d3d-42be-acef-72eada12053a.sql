-- Fix the security warning by setting search_path
CREATE OR REPLACE FUNCTION public.toggle_new_user_trigger(enable_trigger boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF enable_trigger THEN
    -- Re-enable the trigger
    ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
  ELSE
    -- Disable the trigger
    ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
  END IF;
END;
$$;