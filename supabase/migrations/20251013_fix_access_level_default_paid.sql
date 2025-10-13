-- Migration: Correction du access_level par défaut pour les nouvelles sources
-- Date: 2025-10-13
-- Problème: Les nouvelles sources sont créées en 'free' au lieu de 'paid'
-- Solution: Passer le défaut à 'paid' pour forcer la validation admin

-- ============================================================================
-- 1. Corriger le trigger pour emission_factors
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_detect_fe_sources()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- ✅ FIX: Utiliser 'paid' au lieu de 'free' pour les nouvelles sources
  INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
  VALUES (NEW."Source", 'paid', true, true)
  ON CONFLICT (source_name) DO NOTHING;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_detect_fe_sources() IS 
  'Trigger function: Auto-détecte et insère les nouvelles sources dans fe_sources avec access_level=paid (nécessite validation admin)';

-- ============================================================================
-- 2. Corriger le trigger pour user_factor_overlays
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_detect_fe_sources_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- ✅ FIX: Utiliser 'paid' au lieu de 'free' pour les nouvelles sources
  INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
  VALUES (NEW."Source", 'paid', true, true)
  ON CONFLICT (source_name) DO NOTHING;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.auto_detect_fe_sources_user() IS 
  'Trigger function: Auto-détecte les sources des imports utilisateur pour fe_sources avec access_level=paid';

-- ============================================================================
-- 3. Mettre à jour run_import_from_staging() pour utiliser 'paid'
-- ============================================================================

-- Note: La modification a été faite directement dans le fichier
-- 20251013_add_error_handling_import.sql (ligne 156: 'free' → 'paid')

-- ============================================================================
-- 4. Mettre à jour les 5 sources récemment ajoutées en 'paid'
-- ============================================================================

-- Update individuel pour éviter les timeouts
DO $$
DECLARE
  v_source text;
  v_sources text[] := ARRAY['Carbon Minds', 'Ecoinvent 3.11', 'Ecobalyse', 'Roundarc', 'Negaoctet'];
BEGIN
  FOREACH v_source IN ARRAY v_sources LOOP
    UPDATE public.fe_sources
    SET access_level = 'paid'
    WHERE source_name = v_source
      AND access_level = 'free';
    
    RAISE NOTICE 'Source "%" passée en paid', v_source;
  END LOOP;
END$$;

-- ============================================================================
-- 5. Rebuilder la projection avec les nouveaux access_level
-- ============================================================================

-- Note: Le rebuild sera fait manuellement après la migration
-- pour éviter les timeouts (434k lignes à rebuilder)
-- Commande: SELECT public.rebuild_emission_factors_all_search();

-- ============================================================================
-- 6. Vérification finale
-- ============================================================================

DO $$
DECLARE
  v_free_sources int;
  v_paid_sources int;
  v_auto_detected_paid int;
  v_recent_sources_paid int;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE access_level = 'free') as free_count,
    COUNT(*) FILTER (WHERE access_level = 'paid') as paid_count,
    COUNT(*) FILTER (WHERE access_level = 'paid' AND auto_detected = true) as auto_paid_count
  INTO v_free_sources, v_paid_sources, v_auto_detected_paid
  FROM public.fe_sources;
  
  SELECT COUNT(*) INTO v_recent_sources_paid
  FROM public.fe_sources
  WHERE source_name IN ('Carbon Minds', 'Ecoinvent 3.11', 'Ecobalyse', 'Roundarc', 'Negaoctet')
    AND access_level = 'paid';
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ Configuration access_level des sources:';
  RAISE NOTICE '   - Sources gratuites: %', v_free_sources;
  RAISE NOTICE '   - Sources payantes: %', v_paid_sources;
  RAISE NOTICE '   - Sources auto-détectées payantes: %', v_auto_detected_paid;
  RAISE NOTICE '   - Sources récentes (5) en paid: %', v_recent_sources_paid;
  
  IF v_recent_sources_paid = 5 THEN
    RAISE NOTICE '🎉 Les 5 sources récentes sont bien en "paid"';
  ELSE
    RAISE WARNING '⚠️  Seulement % des 5 sources récentes sont en "paid"', v_recent_sources_paid;
  END IF;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE 'ℹ️  Prochaine étape: Rebuilder emission_factors_all_search';
  RAISE NOTICE '   Commande: SELECT public.rebuild_emission_factors_all_search();';
  RAISE NOTICE '============================================';
END$$;

