-- Migration: Créer table benchmarks pour sauvegarde des benchmarks générés
-- Date: 2025-10-22
-- Description: Table pour stocker les benchmarks avec RLS pour partage workspace

-- Créer table benchmarks
CREATE TABLE IF NOT EXISTS public.benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  
  -- Paramètres de recherche originaux
  search_query text NOT NULL,
  search_filters jsonb,
  facet_filters jsonb,
  
  -- Métadonnées
  title text NOT NULL,
  description text,
  unit text NOT NULL,
  scope text NOT NULL,
  sample_size integer NOT NULL,
  sources text[] NOT NULL,
  
  -- Statistiques calculées
  statistics jsonb NOT NULL,
  
  -- Données du graphique (tous les FE pour régénération flexible)
  chart_data jsonb NOT NULL,
  
  -- Top 10 et Worst 10 complets
  top10 jsonb NOT NULL,
  worst10 jsonb NOT NULL,
  
  -- Métadonnées complètes
  metadata jsonb NOT NULL,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Soft delete
  deleted_at timestamptz,
  
  CONSTRAINT benchmarks_sample_size_positive CHECK (sample_size > 0)
);

-- Index de performance
CREATE INDEX IF NOT EXISTS idx_benchmarks_workspace 
  ON public.benchmarks(workspace_id) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_benchmarks_created_by 
  ON public.benchmarks(created_by) 
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_benchmarks_created_at 
  ON public.benchmarks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_benchmarks_unit 
  ON public.benchmarks(unit) 
  WHERE deleted_at IS NULL;

-- Commentaire
COMMENT ON TABLE public.benchmarks IS 'Benchmarks sauvegardés par les utilisateurs Pro pour analyse et partage dans le workspace';

-- RLS
ALTER TABLE public.benchmarks ENABLE ROW LEVEL SECURITY;

-- Politique SELECT : Tous les membres du workspace peuvent voir
CREATE POLICY "Workspace members can view benchmarks"
  ON public.benchmarks FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.users WHERE user_id = auth.uid()
    )
    AND deleted_at IS NULL
  );

-- Politique INSERT : Créateur uniquement
CREATE POLICY "Users can create benchmarks"
  ON public.benchmarks FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.users WHERE user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Politique UPDATE : Tous les membres du workspace
CREATE POLICY "Workspace members can update benchmarks"
  ON public.benchmarks FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.users WHERE user_id = auth.uid()
    )
  );

-- Politique DELETE : Tous les membres du workspace (soft delete)
CREATE POLICY "Workspace members can delete benchmarks"
  ON public.benchmarks FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.users WHERE user_id = auth.uid()
    )
  );

-- Trigger pour updated_at (réutilise fonction existante)
CREATE TRIGGER update_benchmarks_updated_at
  BEFORE UPDATE ON public.benchmarks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Log de succès
DO $$
DECLARE
  v_table_exists boolean;
  v_policies_count integer;
BEGIN
  -- Vérifier que la table existe
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'benchmarks'
  ) INTO v_table_exists;
  
  -- Compter les policies
  SELECT COUNT(*) INTO v_policies_count
  FROM pg_policies
  WHERE tablename = 'benchmarks';
  
  RAISE NOTICE '✅ Migration 20251022092500: Table benchmarks créée';
  RAISE NOTICE '   - Table existe: %', v_table_exists;
  RAISE NOTICE '   - RLS activé avec % policies', v_policies_count;
  RAISE NOTICE '   - 4 index créés pour performance';
  RAISE NOTICE '   - Trigger updated_at configuré';
END $$;

