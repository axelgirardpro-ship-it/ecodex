-- SEED PREMIUM BLUR v2 (teaser + full) avec table temporaire
SET search_path = public;

-- 0) Workspace de test si absent
INSERT INTO public.workspaces (id, name)
SELECT gen_random_uuid(), 'Test Workspace'
WHERE NOT EXISTS (SELECT 1 FROM public.workspaces);

-- 1) Construire un set premium dans une table temporaire
DROP TABLE IF EXISTS tmp_premium_mocked;
CREATE TEMP TABLE tmp_premium_mocked AS
WITH wk AS (
  SELECT id AS workspace_id FROM public.workspaces ORDER BY created_at NULLS LAST LIMIT 1
),
base AS (
  SELECT 
    ef.id                 AS ef_id,
    ef."Nom",
    ef."Description",
    ef."Unité donnée d'activité",
    ef."Périmètre",
    COALESCE(NULLIF(ef."Secteur", ''), '(n/a)')   AS "Secteur",
    ef."Sous-secteur",
    ef."Localisation",
    ef."Incertitude",
    ef."Commentaires",
    COALESCE(NULLIF(ef."Source", ''), '(n/a)')    AS "Source"
  FROM public.emission_factors ef
  WHERE COALESCE(ef.is_latest, true) = true
    AND COALESCE(ef.language, 'fr') = 'fr'
  ORDER BY random()
  LIMIT 5
)
SELECT 
  b.*, 
  round((random()*1000)::numeric, 4) AS fe_num,
  (EXTRACT(YEAR FROM now())::int - (floor(random()*5))::int) AS date_int,
  (SELECT workspace_id FROM wk) AS ws_id
FROM base b;

-- 2) Teaser premium (blur)
INSERT INTO public.emission_factors_public_search_fr (
  object_id, group_id, variant, variant_rank,
  "Nom", "Description", "FE", "Unité donnée d'activité", "Périmètre",
  "Secteur", "Sous-secteur", "Localisation", "Date", "Incertitude",
  "Commentaires", "Source",
  access_level, is_global, is_blurred, language, assigned_workspace_ids
)
SELECT 
  gen_random_uuid(), t.ef_id, 'teaser', 0,
  COALESCE(t."Nom", '(sans nom)'),
  NULL,
  NULL::numeric,
  t."Unité donnée d'activité",
  t."Périmètre",
  t."Secteur",
  t."Sous-secteur",
  t."Localisation",
  t.date_int,
  t."Incertitude",
  NULL,
  t."Source",
  'premium', true, true, 'fr', NULL::uuid[]
FROM tmp_premium_mocked t;

-- 3) Full premium (assigné au workspace de test)
INSERT INTO public.emission_factors_public_search_fr (
  object_id, group_id, variant, variant_rank,
  "Nom", "Description", "FE", "Unité donnée d'activité", "Périmètre",
  "Secteur", "Sous-secteur", "Localisation", "Date", "Incertitude",
  "Commentaires", "Source",
  access_level, is_global, is_blurred, language, assigned_workspace_ids
)
SELECT 
  gen_random_uuid(), t.ef_id, 'full', 1,
  COALESCE(t."Nom", '(sans nom)'),
  t."Description",
  t.fe_num,
  t."Unité donnée d'activité",
  t."Périmètre",
  t."Secteur",
  t."Sous-secteur",
  t."Localisation",
  t.date_int,
  t."Incertitude",
  COALESCE(t."Commentaires", '') || ' [PREMIUM FULL]',
  t."Source",
  'premium', true, false, 'fr', ARRAY[(SELECT id FROM public.workspaces ORDER BY created_at NULLS LAST LIMIT 1)]
FROM tmp_premium_mocked t;
