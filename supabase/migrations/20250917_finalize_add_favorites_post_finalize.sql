-- Migration: finalize_user_import ajoute l'appel à add_import_overlays_to_favorites
-- Idempotente

CREATE OR REPLACE FUNCTION public.finalize_user_import(
  p_workspace_id uuid,
  p_dataset_name text,
  p_import_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_user_id uuid;
  v_attempt int := 0;
  v_has_object boolean := false;
  v_add jsonb := '{}'::jsonb;
BEGIN
  -- Upsert overlays depuis le staging
  v_result := public.batch_upsert_user_factor_overlays(
    p_workspace_id,
    p_dataset_name,
    (
      SELECT jsonb_agg(to_jsonb(sui) - 'created_at')
      FROM public.staging_user_imports sui
      WHERE sui.workspace_id = p_workspace_id AND sui.dataset_name = p_dataset_name AND sui.import_id = p_import_id
    )
  );

  -- Clôturer l'import
  UPDATE public.data_imports SET status = 'completed', finished_at = now() WHERE id = p_import_id;

  -- Récupérer l'utilisateur initiateur de l'import
  SELECT user_id INTO v_user_id FROM public.data_imports WHERE id = p_import_id;

  -- Attente courte pour garantir la présence des object_id côté user_batch_algolia
  WHILE v_attempt < 30 LOOP  -- ~15s max
    SELECT EXISTS(
      SELECT 1 FROM public.user_batch_algolia
      WHERE workspace_id = p_workspace_id
        AND dataset_name = p_dataset_name
        AND object_id IS NOT NULL
    ) INTO v_has_object;

    EXIT WHEN v_has_object;
    PERFORM pg_sleep(0.5);
    v_attempt := v_attempt + 1;
  END LOOP;

  -- Ajout aux favoris côté DB (idempotent via ON CONFLICT DO NOTHING)
  IF v_user_id IS NOT NULL THEN
    BEGIN
      SELECT public.add_import_overlays_to_favorites(v_user_id, p_workspace_id, p_dataset_name) INTO v_add;
      INSERT INTO public.audit_logs(user_id, action, details)
      VALUES (v_user_id, 'add_import_overlays_to_favorites_from_finalize', jsonb_build_object(
        'workspace_id', p_workspace_id,
        'dataset_name', p_dataset_name,
        'attempts', v_attempt,
        'rpc_result', v_add
      ));
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.audit_logs(user_id, action, details)
      VALUES (v_user_id, 'add_import_overlays_to_favorites_from_finalize_error', jsonb_build_object(
        'workspace_id', p_workspace_id,
        'dataset_name', p_dataset_name,
        'attempts', v_attempt,
        'error', sqlerrm
      ));
    END;
  END IF;

  RETURN jsonb_build_object('overlays', v_result);
END $$;


