-- Create a function to temporarily disable/enable the handle_new_user trigger
CREATE OR REPLACE FUNCTION public.toggle_new_user_trigger(enable_trigger boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.toggle_new_user_trigger(boolean) TO service_role;