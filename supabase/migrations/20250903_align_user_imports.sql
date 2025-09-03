-- Alignement imports users sur pipeline robuste (chunked-upload + queue + cron)
-- Date: 2025-09-03

-- 1) Colonnes supplémentaires sur import_jobs
ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS job_kind text CHECK (job_kind IN ('admin','user')) DEFAULT 'admin';
ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS workspace_id uuid;
ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS dataset_name text;

-- 2) Validation dataset
CREATE OR REPLACE FUNCTION public.validate_dataset_name(p text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p IS NULL OR length(trim(p)) < 2 THEN RETURN FALSE; END IF;
  IF p ~ '^\d+$' THEN RETURN FALSE; END IF; -- pas juste des chiffres
  IF lower(p) ~ '^(kg|m|l|€|kwh|km|unite|unité|unit)$' THEN RETURN FALSE; END IF;
  RETURN TRUE;
END $$;

-- 3) Assurer assignation de la Source au workspace pour jobs users
CREATE OR REPLACE FUNCTION public.ensure_user_source_assignment(p_job_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE v_job record; BEGIN
  SELECT id, job_kind, workspace_id, dataset_name INTO v_job FROM public.import_jobs WHERE id = p_job_id;
  IF NOT FOUND THEN RETURN 'job_not_found'; END IF;
  IF v_job.job_kind <> 'user' THEN RETURN 'skipped_non_user'; END IF;
  IF v_job.workspace_id IS NULL OR v_job.dataset_name IS NULL THEN RETURN 'skipped_missing_params'; END IF;
  IF NOT public.validate_dataset_name(v_job.dataset_name) THEN RETURN 'invalid_dataset_name'; END IF;
  INSERT INTO public.fe_sources(source_name, access_level, is_global)
  VALUES (v_job.dataset_name, 'standard', false)
  ON CONFLICT (source_name) DO UPDATE SET updated_at = now();
  INSERT INTO public.fe_source_workspace_assignments(source_name, workspace_id, assigned_by)
  VALUES (v_job.dataset_name, v_job.workspace_id, NULL)
  ON CONFLICT (source_name, workspace_id) DO NOTHING;
  RETURN 'ok';
END $$;

-- 4) Finalisation router (admin → reindex atomique, user → sync incrémentale par Source)
CREATE OR REPLACE FUNCTION public.finalize_completed_imports()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE r RECORD; v_count int := 0; v_srk text; v_base text; v_status int; v_resp jsonb; BEGIN
  SELECT decrypted_secrets.decrypted_secret INTO v_srk FROM vault.decrypted_secrets WHERE name='service_role_key' LIMIT 1;
  IF v_srk IS NULL OR length(v_srk)=0 THEN RETURN 'no_service_role_key'; END IF;
  v_base := current_setting('app.supabase_functions_base', true);
  IF v_base IS NULL OR v_base = '' THEN v_base := 'https://wrodvaatdujbpfpvrzge.supabase.co/functions/v1'; END IF;
  FOR r IN (
    SELECT * FROM public.import_jobs 
    WHERE status='completed' 
      AND (finished_at IS NULL OR finished_at > now() - interval '1 day')
      AND (indexed_at IS NULL)
    ORDER BY created_at
  ) LOOP
    IF r.job_kind = 'admin' THEN
      SELECT status, content::jsonb INTO v_status, v_resp
      FROM http( ('POST', v_base||'/reindex-ef-all-atomic', ARRAY[('Authorization', 'Bearer '||v_srk)::http_header, ('Content-Type','application/json')::http_header], '{}', NULL)::http_request );
    ELSE
      SELECT status, content::jsonb INTO v_status, v_resp
      FROM http( ('POST', v_base||'/algolia-batch-optimizer?action=sync', ARRAY[('Authorization','Bearer '||v_srk)::http_header, ('Content-Type','application/json')::http_header], json_build_object('sources', ARRAY[r.dataset_name], 'operation','incremental_sync', 'priority',3, 'estimated_records', COALESCE(r.inserted_records,0))::text, NULL)::http_request );
    END IF;
    IF v_status BETWEEN 200 AND 299 THEN
      UPDATE public.import_jobs SET indexed_at = now() WHERE id=r.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN 'finalized_'||v_count;
END $$;

-- 5) Vue de statut user (pour UI /import)
CREATE OR REPLACE VIEW public.user_import_status AS
SELECT id, user_id, workspace_id, job_kind, status, processed_chunks, total_chunks, progress_percent,
       inserted_records, total_records, created_at, finished_at,
       CASE WHEN COALESCE(processed_chunks,0) > 0 AND total_chunks IS NOT NULL AND total_chunks > 0
            THEN (EXTRACT(EPOCH FROM (now() - created_at)) * (total_chunks - processed_chunks) / GREATEST(processed_chunks,1))::int
            ELSE NULL END AS eta_seconds
FROM public.import_jobs
WHERE job_kind = 'user'
ORDER BY created_at DESC;
