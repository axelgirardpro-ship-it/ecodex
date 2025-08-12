-- Create user_sessions table for session tracking
CREATE TABLE public.user_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_token TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  last_activity TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days')
);

-- Enable RLS on user_sessions
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for user_sessions
CREATE POLICY "Users can view their own sessions" 
ON public.user_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can manage sessions" 
ON public.user_sessions 
FOR ALL 
USING (true);

-- Add index for performance
CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions(expires_at);

-- Update search_quotas to enforce 100 exports/month for all plans
UPDATE public.search_quotas 
SET exports_limit = 100 
WHERE exports_limit != 100;

-- Set default exports_limit to 100 for future records
ALTER TABLE public.search_quotas 
ALTER COLUMN exports_limit SET DEFAULT 100;

-- Add more detailed audit fields to audit_logs if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'session_id') THEN
    ALTER TABLE public.audit_logs ADD COLUMN session_id UUID;
  END IF;
END $$;

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.user_sessions 
  WHERE expires_at < now();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Function to limit concurrent sessions per user (max 2)
CREATE OR REPLACE FUNCTION public.enforce_session_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  session_count INTEGER;
BEGIN
  -- Count current active sessions for this user
  SELECT COUNT(*) INTO session_count
  FROM public.user_sessions
  WHERE user_id = NEW.user_id 
  AND expires_at > now();
  
  -- If more than 2 sessions, delete the oldest ones
  IF session_count >= 2 THEN
    DELETE FROM public.user_sessions
    WHERE user_id = NEW.user_id
    AND id IN (
      SELECT id FROM public.user_sessions
      WHERE user_id = NEW.user_id
      AND expires_at > now()
      ORDER BY last_activity ASC
      LIMIT (session_count - 1)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce session limit
CREATE TRIGGER enforce_session_limit_trigger
  BEFORE INSERT ON public.user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_session_limit();