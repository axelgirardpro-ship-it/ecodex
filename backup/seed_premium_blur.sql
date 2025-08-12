-- SEED PREMIUM BLUR (teaser + full) pour tests
SET search_path = public;

-- 0) Workspace de test si absent
INSERT INTO public.workspaces (id, name)
SELECT gen_random_uuid(), 'Test Workspace'
WHERE NOT EXISTS (SELECT 1 FROM public.workspaces);

-- 1) Sélectionner 5 facteurs (is_latest, fr)
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
),
mocked AS (
  SELECT 
    b.*, 
    round((random()*1000)::numeric, 4) AS fe_num,
    (EXTRACT(YEAR FROM now())::int - (floor(random()*5))::int) AS date_int,
    (SELECT workspace_id FROM wk) AS ws_id
  FROM base b
)

-- 2) Insérer variantes premium teaser (blur sur FE, Description, Commentaires)
INSERT INTO public.emission_factors_public_search_fr (
  object_id, group_id, variant, variant_rank,
  "Nom", "Description", "FE", "Unité donnée d'activité", "Périmètre",
  "Secteur", "Sous-secteur", "Localisation", "Date", "Incertitude",
  "Commentaires", "Source",
  access_level, is_global, is_blurred, language, assigned_workspace_ids
)
SELECT 
  gen_random_uuid(), m.ef_id, 'teaser', 0,
  COALESCE(m."Nom", '(sans nom)'),
  NULL,                       -- Description floutée
  NULL::numeric,              -- FE flouté
  m."Unité donnée d'activité",
  m."Périmètre",
  m."Secteur",
  m."Sous-secteur",
  m."Localisation",
  m.date_int,
  m."Incertitude",
  NULL,                       -- Commentaires floutés
  m."Source",
  'premium', true, true, 'fr', NULL::uuid[]
FROM mocked m;

-- 3) Insérer variantes premium full (assignées au workspace de test)
INSERT INTO public.emission_factors_public_search_fr (
  object_id, group_id, variant, variant_rank,
  "Nom", "Description", "FE", "Unité donnée d'activité", "Périmètre",
  "Secteur", "Sous-secteur", "Localisation", "Date", "Incertitude",
  "Commentaires", "Source",
  access_level, is_global, is_blurred, language, assigned_workspace_ids
)
SELECT 
  gen_random_uuid(), m.ef_id, 'full', 1,
  COALESCE(m."Nom", '(sans nom)'),
  m."Description",
  m.fe_num,
  m."Unité donnée d'activité",
  m."Périmètre",
  m."Secteur",
  m."Sous-secteur",
  m."Localisation",
  m.date_int,
  m."Incertitude",
  COALESCE(m."Commentaires", '') || ' [PREMIUM FULL]',
  m."Source",
  'premium', true, false, 'fr', ARRAY[m.ws_id]
FROM mocked m;
