-- Create chatbot_usage table for AI chatbot query tracking
CREATE TABLE IF NOT EXISTS public.chatbot_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('freemium', 'pro')),
  queries_count INTEGER DEFAULT 0 CHECK (queries_count >= 0),
  month_year TEXT, -- YYYY-MM for 'pro' plans, NULL for 'freemium'
  last_query_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index pour optimiser les requêtes
CREATE INDEX IF NOT EXISTS idx_chatbot_usage_user ON public.chatbot_usage USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_usage_user_month ON public.chatbot_usage USING btree (user_id, month_year);

-- Contrainte unique : un user peut avoir plusieurs entrées (une par mois pour pro, une seule avec month_year=NULL pour freemium)
-- Pour freemium : user_id avec month_year=NULL (une seule ligne lifetime)
-- Pour pro : user_id avec month_year='2024-10' (une ligne par mois)
CREATE UNIQUE INDEX IF NOT EXISTS unique_chatbot_usage_user_month 
ON public.chatbot_usage (user_id, COALESCE(month_year, 'lifetime'));

-- Enable RLS
ALTER TABLE public.chatbot_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own chatbot usage" 
ON public.chatbot_usage 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can insert chatbot usage" 
ON public.chatbot_usage 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update chatbot usage" 
ON public.chatbot_usage 
FOR UPDATE 
USING (true);

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_chatbot_usage_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chatbot_usage_updated_at
  BEFORE UPDATE ON public.chatbot_usage
  FOR EACH ROW
  EXECUTE FUNCTION update_chatbot_usage_updated_at();

