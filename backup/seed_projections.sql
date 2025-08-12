-- SEED TEST PROJECTIONS (robuste) — 10 bases, conversions sûres

-- 0) Workspace de test si absent
INSERT INTO public.workspaces (id, name)
SELECT gen_random_uuid(), 'Test Workspace'
WHERE NOT EXISTS (SELECT 1 FROM public.workspaces);

WITH wk AS (
  SELECT id AS workspace_id FROM public.workspaces ORDER BY created_at NULLS LAST LIMIT 1
),
picked AS (
  SELECT
    ef.id                 AS ef_id,
    gen_random_uuid()     AS group_id,
    ef."Nom",
    ef."Description",
    ef."FE",
    ef."Unité donnée d'activité",
    ef."Périmètre",
    ef."Secteur",
    ef."Sous-secteur",
    ef."Localisation",
    ef."Date",
    ef."Incertitude",
    ef."Commentaires",
    ef."Source",
    row_number() OVER () AS rn
  FROM public.emission_factors ef
  WHERE COALESCE(ef.is_latest, true) = true
    AND COALESCE(ef.language, 'fr') = 'fr'
  ORDER BY random()
  LIMIT 10
),
-- 5 premium, 5 standard (pour tester le blur)
labeled AS (
  SELECT p.*, CASE WHEN p.rn <= 5 THEN 'premium' ELSE 'standard' END AS access_level
  FROM picked p
),
norm AS (
  SELECT
    l.*,
    -- FE sûr: si texte numérique => cast; sinon fallback random
    CASE
      WHEN replace(trim(COALESCE(l."FE", '')), ',', '.') ~ '^[+-]?([0-9]+(\.[0-9]+)?|\.[0-9]+)$'
        THEN replace(trim(l."FE"), ',', '.')::numeric
      ELSE round((random()*1000)::numeric, 4)
    END AS fe_num,
    -- Date sûre: extraire AAAA sinon année courante
    CASE
      WHEN regexp_replace(COALESCE(l."Date", ''), '\\D', '', 'g') ~ '^[0-9]{4}$'
        THEN regexp_replace(COALESCE(l."Date", ''), '\\D', '', 'g')::int
      ELSE EXTRACT(YEAR FROM now())::int
    END AS date_int
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
  gen_random_uuid(), n.group_id, 'teaser', 0,
  COALESCE(n."Nom",'(sans nom)'), NULL, NULL::numeric,
  n."Unité donnée d'activité", n."Périmètre",
  COALESCE(n."Secteur",'(n/a)'), n."Sous-secteur", n."Localisation",
  n.date_int, n."Incertitude", NULL, COALESCE(n."Source",'(n/a)'),
  'premium', true, true, 'fr', NULL::uuid[]
FROM norm n
WHERE n.access_level = 'premium';

-- 2) PUBLIC: premium full (assigné au workspace de test)
INSERT INTO public.emission_factors_public_search_fr (
  object_id, group_id, variant, variant_rank,
  "Nom", "Description", "FE", "Unité donnée d'activité", "Périmètre",
  "Secteur", "Sous-secteur", "Localisation", "Date", "Incertitude",
  "Commentaires", "Source",
  access_level, is_global, is_blurred, language, assigned_workspace_ids
)
SELECT
  gen_random_uuid(), n.group_id, 'full', 1,
  COALESCE(n."Nom",'(sans nom)'), n."Description", n.fe_num,
  n."Unité donnée d'activité", n."Périmètre",
  COALESCE(n."Secteur",'(n/a)'), n."Sous-secteur", n."Localisation",
  n.date_int, n."Incertitude",
  COALESCE(n."Commentaires",'') || ' [SEED]', COALESCE(n."Source",'(n/a)'),
  'premium', true, false, 'fr', ARRAY[(SELECT workspace_id FROM wk)]
FROM norm n
WHERE n.access_level = 'premium';

-- 3) PUBLIC: standard (full)
INSERT INTO public.emission_factors_public_search_fr (
  object_id, group_id, variant, variant_rank,
  "Nom", "Description", "FE", "Unité donnée d'activité", "Périmètre",
  "Secteur", "Sous-secteur", "Localisation", "Date", "Incertitude",
  "Commentaires", "Source",
  access_level, is_global, is_blurred, language, assigned_workspace_ids
)
SELECT
  gen_random_uuid(), n.group_id, 'full', 1,
  COALESCE(n."Nom",'(sans nom)'), n."Description", n.fe_num,
  n."Unité donnée d'activité", n."Périmètre",
  COALESCE(n."Secteur",'(n/a)'), n."Sous-secteur", n."Localisation",
  n.date_int, n."Incertitude",
  COALESCE(n."Commentaires",'') || ' [SEED]', COALESCE(n."Source",'(n/a)'),
  'standard', true, false, 'fr', NULL::uuid[]
FROM norm n
WHERE n.access_level = 'standard';

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
  COALESCE(n."Nom",'(sans nom)'), n."Description",
  n.fe_num,
  COALESCE(n."Unité donnée d'activité",'(n/a)'),
  n."Périmètre",
  COALESCE(n."Secteur",'(n/a)'),
  n."Sous-secteur",
  n."Localisation",
  n.date_int, n."Incertitude",
  COALESCE(n."Commentaires",'') || ' [SEED]',
  COALESCE(n."Source",'(n/a)'),
  (SELECT workspace_id FROM wk),
  'imported',
  COALESCE(n.access_level,'standard'),
  false, 'fr'
FROM norm n;
