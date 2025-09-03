-- Alignement imports supra admin (chunked-upload + queue + cron + reindex atomique)
-- Date: 2025-09-03

-- 1) Table de settings (si absente) et valeurs par défaut
CREATE TABLE IF NOT EXISTS public.import_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.import_settings(key, value)
VALUES
  ('lines_per_chunk', '500'::jsonb),
  ('micro_batch_size', '25'::jsonb),
  ('max_retries', '3'::jsonb),
  ('backoff_base_seconds', '30'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2) Indexes et unicité sur import_chunks
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='uniq_import_chunks_job_chunk'
  ) THEN
    CREATE UNIQUE INDEX uniq_import_chunks_job_chunk ON public.import_chunks(job_id, chunk_number);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_import_chunks_job_processed ON public.import_chunks(job_id, processed);

-- 3) Fonction de progression du job
CREATE OR REPLACE FUNCTION public.update_job_progress(p_job_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_total int; v_done int; v_percent int; v_inserted int; v_records int; BEGIN
  SELECT total_chunks INTO v_total FROM public.import_jobs WHERE id = p_job_id;
  SELECT COALESCE(SUM(CASE WHEN processed THEN 1 ELSE 0 END),0), COALESCE(SUM(inserted_count),0), COALESCE(SUM(records_count),0)
    INTO v_done, v_inserted, v_records
  FROM public.import_chunks WHERE job_id = p_job_id;
  v_percent := CASE WHEN COALESCE(v_total,0) > 0 THEN LEAST(100, GREATEST(0, (v_done*100)/GREATEST(v_total,1))) ELSE 0 END;
  UPDATE public.import_jobs
     SET processed_chunks = v_done,
         inserted_records = v_inserted,
         total_records = v_records,
         progress_percent = v_percent,
         status = CASE WHEN COALESCE(v_total,0) > 0 AND v_done >= v_total THEN 'completed' ELSE 'processing' END,
         finished_at = CASE WHEN COALESCE(v_total,0) > 0 AND v_done >= v_total THEN now() ELSE finished_at END,
         updated_at = now()
   WHERE id = p_job_id;
END $$;

-- 4) Enqueue chunk creation (appelle l'Edge create-chunks pour jobs en attente)
CREATE OR REPLACE FUNCTION public.enqueue_chunk_creation()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE r RECORD; v_srk text; v_base text; v_count int := 0; v_status int; v_resp jsonb; BEGIN
  SELECT decrypted_secrets.decrypted_secret INTO v_srk FROM vault.decrypted_secrets WHERE name='service_role_key' LIMIT 1;
  IF v_srk IS NULL OR length(v_srk)=0 THEN RETURN 'no_service_role_key'; END IF;
  v_base := current_setting('app.supabase_functions_base', true);
  IF v_base IS NULL OR v_base = '' THEN v_base := 'https://wrodvaatdujbpfpvrzge.supabase.co/functions/v1'; END IF;
  FOR r IN (
    SELECT id FROM public.import_jobs 
     WHERE status='queued' AND file_path IS NOT NULL AND (total_chunks IS NULL OR total_chunks=0)
     ORDER BY created_at ASC LIMIT 10
  ) LOOP
    SELECT status, content::jsonb INTO v_status, v_resp
    FROM http( ('POST', v_base||'/create-chunks',
      ARRAY[('Authorization','Bearer '||v_srk)::http_header, ('Content-Type','application/json')::http_header],
      json_build_object('job_id', r.id)::text, NULL)::http_request );
    IF v_status BETWEEN 200 AND 299 THEN v_count := v_count + 1; END IF;
  END LOOP;
  RETURN 'enqueued_'||v_count;
END $$;

-- 5) Vue de statut admin
CREATE OR REPLACE VIEW public.import_status AS
SELECT 
  j.id,
  j.status,
  j.processed_chunks,
  j.total_chunks,
  j.progress_percent,
  j.inserted_records,
  j.total_records,
  j.created_at,
  j.finished_at,
  j.indexed_at,
  CASE
    WHEN COALESCE(j.processed_chunks,0) > 0 AND j.total_chunks IS NOT NULL AND j.total_chunks > 0
    THEN (EXTRACT(EPOCH FROM (now() - j.created_at)) * (j.total_chunks - j.processed_chunks) / GREATEST(j.processed_chunks,1))::int
    ELSE NULL
  END AS eta_seconds,
  CASE
    WHEN COALESCE(j.processed_chunks,0) > 0 AND j.total_chunks IS NOT NULL AND j.total_chunks > 0
    THEN now() + make_interval(secs => (EXTRACT(EPOCH FROM (now() - j.created_at)) * (j.total_chunks - j.processed_chunks) / GREATEST(j.processed_chunks,1))::int)
    ELSE NULL
  END AS estimated_completion_at
FROM public.import_jobs j
ORDER BY j.created_at DESC;

-- 6) Crons DB
SELECT cron.schedule('process-import-queue','* * * * *','select public.process_import_queue();');
SELECT cron.schedule('retry-failed-jobs','*/5 * * * *','select public.retry_failed_jobs();');
SELECT cron.schedule('cleanup-stuck-jobs','*/30 * * * *','select public.cleanup_stuck_jobs();');
SELECT cron.schedule('finalize-completed-imports','*/5 * * * *','select public.finalize_completed_imports();');
SELECT cron.schedule('continue-chunk-creation','* * * * *','select public.enqueue_chunk_creation();');
