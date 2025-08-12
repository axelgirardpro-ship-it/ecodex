-- Migration finale - Nettoyer les dépendances et finaliser

-- 1. Supprimer d'abord la vue workspace_plans qui dépend de subscribers
DROP VIEW IF EXISTS public.workspace_plans;

-- 2. Maintenant supprimer les anciennes tables
DROP TABLE IF EXISTS public.profiles;
DROP TABLE IF EXISTS public.subscribers;

-- 3. Recréer la vue workspace_plans basée sur la nouvelle structure
-- Elle utilise maintenant les données directement depuis workspaces
CREATE VIEW public.workspace_plans AS
SELECT 
  w.id as workspace_id,
  w.name as workspace_name,
  w.owner_id,
  w.plan_type,
  w.subscription_tier,
  -- Pour la compatibilité, on simule les anciennes colonnes à partir de workspaces
  CASE 
    WHEN w.plan_type = 'freemium' THEN false
    ELSE true
  END as subscribed,
  -- Pour les dates, on utilise des valeurs par défaut raisonnables
  CASE 
    WHEN w.plan_type = 'freemium' THEN now() + interval '7 days'
    ELSE null
  END as trial_end,
  null as subscription_end
FROM public.workspaces w;