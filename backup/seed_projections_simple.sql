-- SEED TEST PROJECTIONS (simple et robuste) — 10 bases, sans cast risqué

-- 0) Workspace de test si absent
INSERT INTO public.workspaces (id, name)
SELECT gen_random_uuid(), 'Test Workspace'
WHERE NOT EXISTS (SELECT 1 FROM public.workspaces);

WITH wk AS (
  SELECT id AS workspace_id FROM public.workspaces ORDER BY created_at NULLS LAST LIMIT 1
),
selected AS (
  SELECT
    ef.id                 AS ef_id,
    gen_random_uuid()     AS group_id,
    COALESCE(NULLIF(ef."Nom", ''), '(sans nom)')                AS "Nom",
    ef."Description",
    ef."Unité donnée d'activité",
    ef."Périmètre",
    COALESCE(NULLIF(ef."Secteur", ''), '(n/a)')                 AS "Secteur",
    ef."Sous-secteur",
    ef."Localisation",
    ef."Incertitude",
    ef."Commentaires",
    COALESCE(NULLIF(ef."Source", ''), '(n/a)')                  AS "Source",
    row_number() OVER () AS rn
  FROM public.emission_factors ef
  WHERE COALESCE(ef.is_latest, true) = true
    AND COALESCE(ef.language, 'fr') = 'fr'
  ORDER BY random()
  LIMIT 10
),
-- 5 premium, 5 standard (pour tester le blur)
labeled AS (
  SELECT s.*, CASE WHEN s.rn <= 5 THEN 'premium' ELSE 'standard' END AS access_level
  FROM selected s
),
-- Valeurs factices sûres
mocked AS (
  SELECT l.*,
         round((random()*1000)::numeric, 4)                      AS fe_num,
         (EXTRACT(YEAR FROM now())::int - (floor(random()*5))::int) AS date_int
  FROM labeled l
)

-- 1) PUBLIC: premium teaser (flouté)
INSERT INTO public.emission_factors_public_search_fr (
  object_id, group_id, variant, variant_rank,
  "Nom", "Description", "FE", "Unité donnée d'activité", "Périmètre",
  "Secteur", "Sous-secteur", "Localisation", "Date", "Incertitude",
  "Commentaires", "Source",
  access_level, is_global, is_blurred, language, assigned_workspace_ids
)
SELECT
  gen_random_uuid(), m.group_id, 'teaser', 0,
  m."Nom", NULL, NULL::numeric,
  m."Unité donnée d'activité", m."Périmètre",
  m."Secteur", m."Sous-secteur", m."Localisation",
  m.date_int, m."Incertitude", NULL, m."Source",
  'premium', true, true, 'fr', NULL::uuid[]
FROM mocked m
WHERE m.access_level = 'premium';

-- 2) PUBLIC: premium full (assigné au workspace de test)
INSERT INTO public.emission_factors_public_search_fr (
  object_id, group_id, variant, variant_rank,
  "Nom", "Description", "FE", "Unité donnée d'activité", "Périmètre",
  "Secteur", "Sous-secteur", "Localisation", "Date", "Incertitude",
  "Commentaires", "Source",
  access_level, is_global, is_blurred, language, assigned_workspace_ids
)
SELECT
  gen_random_uuid(), m.group_id, 'full', 1,
  m."Nom", m."Description", m.fe_num,
  m."Unité donnée d'activité", m."Périmètre",
  m."Secteur", m."Sous-secteur", m."Localisation",
  m.date_int, m."Incertitude",
  COALESCE(m."Commentaires", '') || ' [SEED]', m."Source",
  'premium', true, false, 'fr', ARRAY[(SELECT workspace_id FROM wk)]
FROM mocked m
WHERE m.access_level = 'premium';

-- 3) PUBLIC: standard (full)
INSERT INTO public.emission_factors_public_search_fr (
  object_id, group_id, variant, variant_rank,
  "Nom", "Description", "FE", "Unité donnée d'activité", "Périmètre",
  "Secteur", "Sous-secteur", "Localisation", "Date", "Incertitude",
  "Commentaires", "Source",
  access_level, is_global, is_blurred, language, assigned_workspace_ids
)
SELECT
  gen_random_uuid(), m.group_id, 'full', 1,
  m."Nom", m."Description", m.fe_num,
  m."Unité donnée d'activité", m."Périmètre",
  m."Secteur", m."Sous-secteur", m."Localisation",
  m.date_int, m."Incertitude",
  COALESCE(m."Commentaires", '') || ' [SEED]', m."Source",
  'standard', true, false, 'fr', NULL::uuid[]
FROM mocked m
WHERE m.access_level = 'standard';

-- 4) PRIVATE: 10 lignes (full)
INSERT INTO public.emission_factors_private_search_fr (
  object_id,
  "Nom", "Description", "FE", "Unité donnée d'activité", "Périmètre",
  "Secteur", "Sous-secteur", "Localisation", "Date", "Incertitude",
  "Commentaires", "Source",
  workspace_id, import_type, access_level, is_global, language
)
SELECT
  gen_random_uuid(),
  m."Nom", m."Description",
  m.fe_num,
  COALESCE(m."Unité donnée d'activité", '(n/a)'),
  m."Périmètre",
  m."Secteur",
  m."Sous-secteur",
  m."Localisation",
  m.date_int, m."Incertitude",
  COALESCE(m."Commentaires", '') || ' [SEED]',
  m."Source",
  (SELECT workspace_id FROM wk),
  'imported',
  COALESCE(m.access_level, 'standard'),
  false, 'fr'
FROM mocked m;
