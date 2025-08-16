-- Migration pour optimiser les webhooks Algolia
-- Version compatible avec toute structure de base existante

-- Créer une table pour les métriques de performance Algolia       
CREATE TABLE IF NOT EXISTS public.algolia_performance_metrics (    
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,          
  metric_type TEXT NOT NULL,                                       
  metric_value NUMERIC NOT NULL,                                   
  additional_data JSONB DEFAULT '{}',                              
  workspace_id TEXT, -- Compatible avec toute structure
  user_id TEXT, -- Compatible avec toute structure
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),      
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()       
);

-- Index pour optimiser les requêtes sur les métriques
CREATE INDEX IF NOT EXISTS idx_algolia_metrics_type_created ON public.algolia_performance_metrics(metric_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_algolia_metrics_workspace ON public.algolia_performance_metrics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_algolia_metrics_user ON public.algolia_performance_metrics(user_id);

-- Table pour le batching des webhooks
CREATE TABLE IF NOT EXISTS public.webhook_batch_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_name TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('insert', 'update', 'delete')),
  object_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
  priority INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index pour optimiser le traitement des batches
CREATE INDEX IF NOT EXISTS idx_webhook_batch_status_priority ON public.webhook_batch_queue(status, priority, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_webhook_batch_source ON public.webhook_batch_queue(source_name);

-- Fonction simplifiée pour enregistrer des métriques
CREATE OR REPLACE FUNCTION public.record_algolia_metric(
  p_metric_type TEXT,
  p_metric_value NUMERIC,
  p_additional_data JSONB DEFAULT '{}',
  p_workspace_id TEXT DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  metric_id UUID;
BEGIN
  INSERT INTO public.algolia_performance_metrics (
    metric_type,
    metric_value,
    additional_data,
    workspace_id,
    user_id
  ) VALUES (
    p_metric_type,
    p_metric_value,
    p_additional_data,
    p_workspace_id,
    p_user_id
  ) RETURNING id INTO metric_id;
  
  RETURN metric_id;
END;
$$;

-- Fonction simplifiée pour ajouter un batch à la queue
CREATE OR REPLACE FUNCTION public.queue_webhook_batch(
  p_source_name TEXT,
  p_operation_type TEXT,
  p_object_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
  p_priority INTEGER DEFAULT 2
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  batch_id UUID;
BEGIN
  INSERT INTO public.webhook_batch_queue (
    source_name,
    operation_type,
    object_ids,
    priority
  ) VALUES (
    p_source_name,
    p_operation_type,
    p_object_ids,
    p_priority
  ) RETURNING id INTO batch_id;
  
  RETURN batch_id;
END;
$$;

-- Fonction simplifiée pour récupérer les prochains batches
CREATE OR REPLACE FUNCTION public.get_next_webhook_batches(
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  source_name TEXT,
  operation_type TEXT,
  object_ids TEXT[],
  priority INTEGER,
  scheduled_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wb.id,
    wb.source_name,
    wb.operation_type,
    wb.object_ids,
    wb.priority,
    wb.scheduled_at
  FROM public.webhook_batch_queue wb
  WHERE wb.status = 'pending'
  AND wb.scheduled_at <= now()
  ORDER BY wb.priority ASC, wb.scheduled_at ASC
  LIMIT p_limit;
END;
$$;

-- Fonction simplifiée pour marquer un batch comme complété
CREATE OR REPLACE FUNCTION public.complete_webhook_batch(
  p_batch_id UUID,
  p_success BOOLEAN,
  p_error_message TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.webhook_batch_queue
  SET 
    status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    processed_at = now(),
    error_message = p_error_message,
    updated_at = now()
  WHERE id = p_batch_id;
  
  RETURN FOUND;
END;
$$;

-- Commentaires
COMMENT ON TABLE public.algolia_performance_metrics IS 'Métriques de performance pour le système Algolia optimisé';
COMMENT ON TABLE public.webhook_batch_queue IS 'Queue pour le batching des webhooks Algolia';
COMMENT ON FUNCTION public.record_algolia_metric IS 'Enregistre une métrique de performance Algolia';
COMMENT ON FUNCTION public.queue_webhook_batch IS 'Ajoute un batch à la queue de webhooks';
COMMENT ON FUNCTION public.get_next_webhook_batches IS 'Récupère les prochains batches à traiter';
COMMENT ON FUNCTION public.complete_webhook_batch IS 'Marque un batch comme complété ou échoué';
