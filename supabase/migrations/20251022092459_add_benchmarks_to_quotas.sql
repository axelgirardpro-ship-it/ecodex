-- Migration: Ajouter colonnes benchmarks dans search_quotas
-- Date: 2025-10-22
-- Description: Extension de search_quotas pour gérer les quotas de benchmarks (Freemium: 3 pendant trial, Pro: illimité)

-- Ajouter colonnes benchmarks dans search_quotas
ALTER TABLE public.search_quotas
ADD COLUMN IF NOT EXISTS benchmarks_used integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS benchmarks_limit integer DEFAULT 3,
ADD COLUMN IF NOT EXISTS benchmarks_reset_date timestamptz;

-- Commentaires
COMMENT ON COLUMN public.search_quotas.benchmarks_used IS 'Nombre de benchmarks générés pendant le trial (Freemium) ou total (Pro)';
COMMENT ON COLUMN public.search_quotas.benchmarks_limit IS 'Limite de benchmarks : 3 pour Freemium (trial), 999 pour Pro';
COMMENT ON COLUMN public.search_quotas.benchmarks_reset_date IS 'Date de reset du quota benchmarks (= trial.expires_at pour Freemium)';

-- Initialiser pour les users existants
UPDATE public.search_quotas
SET benchmarks_limit = 3,
    benchmarks_used = 0
WHERE benchmarks_limit IS NULL;

-- Mettre à jour la fonction ensure_user_quotas pour inclure benchmarks
CREATE OR REPLACE FUNCTION public.ensure_user_quotas()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Récupérer tous les users sans entrée dans search_quotas
  FOR v_user_id IN
    SELECT u.user_id
    FROM public.users u
    LEFT JOIN public.search_quotas sq ON sq.user_id = u.user_id
    WHERE sq.user_id IS NULL
  LOOP
    -- Insérer quota par défaut avec benchmarks
    INSERT INTO public.search_quotas (
      user_id,
      exports_limit,
      clipboard_copies_limit,
      favorites_limit,
      benchmarks_limit,
      exports_used,
      clipboard_copies_used,
      favorites_used,
      benchmarks_used
    ) VALUES (
      v_user_id,
      0,    -- exports: 0 par défaut (Freemium)
      10,   -- clipboard: 10 par défaut
      10,   -- favorites: 10 par défaut
      3,    -- benchmarks: 3 par défaut (Freemium)
      0,
      0,
      0,
      0
    )
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.ensure_user_quotas() IS 'Assure que tous les users ont une entrée dans search_quotas avec quotas par défaut (incluant benchmarks)';

-- Log de succès
DO $$
BEGIN
  RAISE NOTICE '✅ Migration 20251022092459: Colonnes benchmarks ajoutées à search_quotas';
  RAISE NOTICE '   - benchmarks_used: integer DEFAULT 0';
  RAISE NOTICE '   - benchmarks_limit: integer DEFAULT 3';
  RAISE NOTICE '   - benchmarks_reset_date: timestamptz';
  RAISE NOTICE '   - Fonction ensure_user_quotas() mise à jour';
END $$;

