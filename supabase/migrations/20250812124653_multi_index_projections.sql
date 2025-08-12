-- Migration multi-index: créer les projections pour ef_public_fr et ef_private_fr
-- Date: 2025-08-12
-- Objectif: tables de projection pour Algolia avec variants (teaser/full) et language support

-- ============================================================================
-- 1. Étendre emission_factors pour le versioning SCD2 et multi-langue
-- ============================================================================

-- Ajouter colonnes SCD2 et language (migrations additives uniquement)
ALTER TABLE public.emission_factors 
  ADD COLUMN IF NOT EXISTS factor_key text,
  ADD COLUMN IF NOT EXISTS version_id uuid,
  ADD COLUMN IF NOT EXISTS valid_from timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS valid_to timestamptz,
  ADD COLUMN IF NOT EXISTS is_latest boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS import_type text DEFAULT 'official' CHECK (import_type IN ('official','imported','curated'));

-- Ajouter colonne Commentaires si pas présente (pour le blur)
ALTER TABLE public.emission_factors 
  ADD COLUMN IF NOT EXISTS "Commentaires" text;

-- Index pour performances et contraintes
CREATE INDEX IF NOT EXISTS idx_emission_factors_factor_key ON public.emission_factors(factor_key);
CREATE INDEX IF NOT EXISTS idx_emission_factors_is_latest ON public.emission_factors(is_latest);
CREATE INDEX IF NOT EXISTS idx_emission_factors_language ON public.emission_factors(language);
CREATE INDEX IF NOT EXISTS idx_emission_factors_source ON public.emission_factors("Source");
CREATE INDEX IF NOT EXISTS idx_emission_factors_workspace_version ON public.emission_factors(workspace_id, version_id);

-- Index unique partiel: un seul is_latest=true par factor_key
CREATE UNIQUE INDEX IF NOT EXISTS uniq_latest_per_factor 
ON public.emission_factors(factor_key) WHERE is_latest = true;

-- ============================================================================
-- 2. Tables de versioning et staging
-- ============================================================================

-- Table des versions logiques d'import
CREATE TABLE IF NOT EXISTS public.fe_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid,
  version_label text NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  checksum text,
  language text NOT NULL DEFAULT 'fr'
);

CREATE INDEX IF NOT EXISTS idx_fe_versions_created_at ON public.fe_versions(created_at);
CREATE INDEX IF NOT EXISTS idx_fe_versions_language ON public.fe_versions(language);

-- Table de staging pour imports (toutes colonnes en text)
CREATE TABLE IF NOT EXISTS public.emission_factors_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "Nom" text,
  "Description" text,
  "FE" text,
  "Unité donnée d'activité" text,
  "Périmètre" text,
  "Secteur" text,
  "Sous-secteur" text,
  "Localisation" text,
  "Date" text,
  "Incertitude" text,
  "Commentaires" text,
  "Source" text,
  workspace_id uuid,
  uploaded_by uuid NOT NULL,
  data_import_id uuid NOT NULL,
  language text NOT NULL DEFAULT 'fr',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emission_factors_staging_data_import ON public.emission_factors_staging(data_import_id);
CREATE INDEX IF NOT EXISTS idx_emission_factors_staging_workspace ON public.emission_factors_staging(workspace_id);

-- ============================================================================
-- 3. Projection PUBLIC (ef_public_fr) - Global avec variants teaser/full
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.emission_factors_public_search_fr (
  object_id uuid PRIMARY KEY,           -- = emission_factors.id
  group_id uuid NOT NULL,               -- = emission_factors.id (pour distinct)
  variant text NOT NULL CHECK (variant IN ('teaser','full')),
  variant_rank integer NOT NULL,        -- 1=full, 0=teaser (pour customRanking)
  
  -- Champs métier (NULL si variant=teaser pour premium)
  "Nom" text NOT NULL,
  "Description" text,                   -- NULL si premium teaser
  "FE" numeric,                         -- NULL si premium teaser  
  "Unité donnée d'activité" text,       -- NULL si premium teaser
  "Périmètre" text,                     -- NULL si premium teaser
  "Secteur" text NOT NULL,
  "Sous-secteur" text,
  "Localisation" text,
  "Date" integer,
  "Incertitude" text,
  "Commentaires" text,                  -- NULL si premium teaser
  "Source" text NOT NULL,
  
  -- Métadonnées ACL
  access_level text NOT NULL CHECK (access_level IN ('standard','premium')),
  is_global boolean NOT NULL DEFAULT true,
  is_blurred boolean NOT NULL DEFAULT false,
  language text NOT NULL DEFAULT 'fr',
  
  -- Pour les variants "full" premium: workspaces autorisés
  assigned_workspace_ids uuid[],
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index pour Algolia et requêtes
CREATE INDEX IF NOT EXISTS idx_efps_fr_group_variant ON public.emission_factors_public_search_fr(group_id, variant);
CREATE INDEX IF NOT EXISTS idx_efps_fr_source ON public.emission_factors_public_search_fr("Source");
CREATE INDEX IF NOT EXISTS idx_efps_fr_access_level ON public.emission_factors_public_search_fr(access_level);
CREATE INDEX IF NOT EXISTS idx_efps_fr_is_blurred ON public.emission_factors_public_search_fr(is_blurred);
CREATE INDEX IF NOT EXISTS idx_efps_fr_assigned_workspaces ON public.emission_factors_public_search_fr USING GIN(assigned_workspace_ids);

-- ============================================================================
-- 4. Projection PRIVATE (ef_private_fr) - Imports utilisateurs
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.emission_factors_private_search_fr (
  object_id uuid PRIMARY KEY,           -- = emission_factors.id
  
  -- Champs métier (toujours complets)
  "Nom" text NOT NULL,
  "Description" text,
  "FE" numeric NOT NULL,
  "Unité donnée d'activité" text NOT NULL,
  "Périmètre" text,
  "Secteur" text NOT NULL,
  "Sous-secteur" text,
  "Localisation" text,
  "Date" integer,
  "Incertitude" text,
  "Commentaires" text,
  "Source" text NOT NULL,
  
  -- Métadonnées workspace
  workspace_id uuid NOT NULL,
  import_type text NOT NULL DEFAULT 'imported',
  access_level text NOT NULL DEFAULT 'standard',
  is_global boolean NOT NULL DEFAULT false,
  language text NOT NULL DEFAULT 'fr',
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index pour filtrage workspace et requêtes
CREATE INDEX IF NOT EXISTS idx_efps_private_fr_workspace ON public.emission_factors_private_search_fr(workspace_id);
CREATE INDEX IF NOT EXISTS idx_efps_private_fr_import_type ON public.emission_factors_private_search_fr(import_type);
CREATE INDEX IF NOT EXISTS idx_efps_private_fr_source ON public.emission_factors_private_search_fr("Source");

-- ============================================================================
-- 5. RLS pour les projections
-- ============================================================================

-- RLS sur projections (lecture pour connecteur)
ALTER TABLE public.emission_factors_public_search_fr ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emission_factors_private_search_fr ENABLE ROW LEVEL SECURITY;

-- Policies pour connecteur Algolia (lecture ouverte)
CREATE POLICY "Connector can read public search projection"
ON public.emission_factors_public_search_fr
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Connector can read private search projection" 
ON public.emission_factors_private_search_fr
FOR SELECT TO authenticated USING (true);

-- Policies pour supra admins (gestion complète)
CREATE POLICY "Supra admins can manage public search projection"
ON public.emission_factors_public_search_fr
FOR ALL USING (is_supra_admin());

CREATE POLICY "Supra admins can manage private search projection"
ON public.emission_factors_private_search_fr  
FOR ALL USING (is_supra_admin());

-- ============================================================================
-- 6. Triggers de mise à jour timestamps
-- ============================================================================

CREATE TRIGGER update_emission_factors_public_search_fr_updated_at
  BEFORE UPDATE ON public.emission_factors_public_search_fr
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_emission_factors_private_search_fr_updated_at
  BEFORE UPDATE ON public.emission_factors_private_search_fr
  FOR EACH ROW  
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 7. Compléter table data_imports pour monitoring robuste
-- ============================================================================

-- Étendre data_imports si nécessaire
DO $$
BEGIN
  -- Ajouter colonnes manquantes pour monitoring robuste
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'data_imports' AND column_name = 'workspace_id') THEN
    ALTER TABLE public.data_imports ADD COLUMN workspace_id uuid;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'data_imports' AND column_name = 'user_id') THEN
    ALTER TABLE public.data_imports ADD COLUMN user_id uuid;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'data_imports' AND column_name = 'file_size') THEN
    ALTER TABLE public.data_imports ADD COLUMN file_size bigint;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'data_imports' AND column_name = 'storage_path') THEN
    ALTER TABLE public.data_imports ADD COLUMN storage_path text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'data_imports' AND column_name = 'processed') THEN
    ALTER TABLE public.data_imports ADD COLUMN processed integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'data_imports' AND column_name = 'inserted') THEN
    ALTER TABLE public.data_imports ADD COLUMN inserted integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'data_imports' AND column_name = 'updated') THEN
    ALTER TABLE public.data_imports ADD COLUMN updated integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'data_imports' AND column_name = 'failed') THEN
    ALTER TABLE public.data_imports ADD COLUMN failed integer DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'data_imports' AND column_name = 'error_samples') THEN
    ALTER TABLE public.data_imports ADD COLUMN error_samples jsonb;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'data_imports' AND column_name = 'version_id') THEN
    ALTER TABLE public.data_imports ADD COLUMN version_id uuid REFERENCES public.fe_versions(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'data_imports' AND column_name = 'started_at') THEN
    ALTER TABLE public.data_imports ADD COLUMN started_at timestamptz;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'data_imports' AND column_name = 'finished_at') THEN
    ALTER TABLE public.data_imports ADD COLUMN finished_at timestamptz;
  END IF;
END $$;

-- Index pour performance data_imports
CREATE INDEX IF NOT EXISTS idx_data_imports_workspace_created ON public.data_imports(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_imports_status ON public.data_imports(status);

-- ============================================================================
-- 8. Commentaires de documentation
-- ============================================================================

COMMENT ON TABLE public.emission_factors_public_search_fr IS 'Projection pour ef_public_fr: facteurs globaux avec variants teaser/full pour premium';
COMMENT ON TABLE public.emission_factors_private_search_fr IS 'Projection pour ef_private_fr: imports utilisateurs par workspace';

COMMENT ON COLUMN public.emission_factors_public_search_fr.variant IS 'teaser=premium flouté, full=premium complet pour workspaces assignés';
COMMENT ON COLUMN public.emission_factors_public_search_fr.variant_rank IS '1=full (priorité), 0=teaser pour customRanking Algolia';
COMMENT ON COLUMN public.emission_factors_public_search_fr.assigned_workspace_ids IS 'Workspaces autorisés pour variant=full premium';

-- ============================================================================
-- Fin de migration
-- ============================================================================
