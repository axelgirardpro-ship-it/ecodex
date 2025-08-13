-- Nettoyage de la table de projection publique: suppression des colonnes obsolètes

DO $$ BEGIN
  -- Supprimer les index dépendants
  DROP INDEX IF EXISTS public.idx_efps_fr_group_variant;
  DROP INDEX IF EXISTS public.idx_efps_fr_is_blurred;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

ALTER TABLE public.emission_factors_public_search_fr
  DROP COLUMN IF EXISTS group_id,
  DROP COLUMN IF EXISTS variant,
  DROP COLUMN IF EXISTS variant_rank,
  DROP COLUMN IF EXISTS is_blurred,
  DROP COLUMN IF EXISTS is_global,
  DROP COLUMN IF EXISTS created_at,
  DROP COLUMN IF EXISTS updated_at;

-- S'assurer que les colonnes minimales existent (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='emission_factors_public_search_fr' AND column_name='assigned_workspace_ids'
  ) THEN
    ALTER TABLE public.emission_factors_public_search_fr ADD COLUMN assigned_workspace_ids uuid[];
  END IF;
END $$;


