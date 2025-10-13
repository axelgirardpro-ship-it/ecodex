# Plan : Correction du access_level par défaut des nouvelles sources

**Date** : 2025-10-13  
**Problème** : Les nouvelles sources auto-détectées sont créées avec `access_level = 'free'` au lieu de `'paid'`, ce qui les rend visibles par tous les utilisateurs immédiatement au lieu d'être floutées.

---

## 🔴 Problème identifié

### Situation actuelle (incorrecte)

Lors de la détection d'une nouvelle source :
1. ❌ Trigger `auto_detect_fe_sources()` insère avec `access_level = 'free'`
2. ❌ Fonction `run_import_from_staging()` insère avec `access_level = 'free'`
3. ❌ La source est **immédiatement visible** sans validation admin
4. ❌ Pas de floutage (is_blurred = false)

**Résultat** : Les nouvelles sources comme **Carbon Minds** (118k facteurs), **Ecoinvent 3.11** (23k facteurs) sont accessibles gratuitement alors qu'elles sont payantes.

### Flow métier attendu (correct)

1. ✅ Nouvelle source détectée → `access_level = 'paid'` (par défaut)
2. ✅ Données **floutées** dans `emission_factors_all_search` (is_blurred = true, variant = 'teaser')
3. ✅ Admin valide la source depuis la page admin
4. ✅ Admin peut alors :
   - Passer la source en `'free'` → visible par tous
   - Assigner la source à des workspaces spécifiques (si paid)

---

## 📋 Plan de correction

### Étape 1 : Corriger le trigger `auto_detect_fe_sources()`

**Fichier** : Migration SQL  
**Changement** : `'free'` → `'paid'`

```sql
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
```

### Étape 2 : Corriger le trigger `auto_detect_fe_sources_user()`

**Fichier** : Migration SQL  
**Changement** : `'free'` → `'paid'`

```sql
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
```

### Étape 3 : Corriger `run_import_from_staging()`

**Fichier** : `supabase/migrations/20251013_add_error_handling_import.sql` (ligne 156)  
**Changement** : `'free'` → `'paid'`

```sql
-- Ligne 156
INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
SELECT DISTINCT "Source", 'paid', true, true  -- ✅ FIX: 'paid' au lieu de 'free'
FROM temp_dedup 
WHERE "Source" = ANY(v_missing_sources)
ON CONFLICT (source_name) DO NOTHING;
```

### Étape 4 : Mettre à jour les sources récemment ajoutées

**Action** : Passer les 5 sources récemment ajoutées en `'paid'` car elles n'ont pas été validées par un admin.

```sql
-- Mettre à jour Carbon Minds, Ecoinvent 3.11, Ecobalyse, Roundarc, Negaoctet
UPDATE public.fe_sources
SET access_level = 'paid'
WHERE source_name IN ('Carbon Minds', 'Ecoinvent 3.11', 'Ecobalyse', 'Roundarc', 'Negaoctet')
  AND auto_detected = true
  AND created_at >= '2025-10-13 19:58:00';
```

**Alternative** : Si ces sources doivent rester gratuites, l'admin peut les valider manuellement après la migration.

### Étape 5 : Rebuilder la projection avec le bon access_level

```sql
-- Rebuilder emission_factors_all_search avec les nouveaux access_level
SELECT public.rebuild_emission_factors_all_search();
```

---

## 🎯 Résultat attendu

### Avant le fix

| Source | Access Level | Is Blurred | Visible par |
|--------|-------------|-----------|-------------|
| Carbon Minds | `free` ❌ | `false` ❌ | Tous les users ❌ |
| Ecoinvent 3.11 | `free` ❌ | `false` ❌ | Tous les users ❌ |
| Ecobalyse | `free` ❌ | `false` ❌ | Tous les users ❌ |
| Roundarc | `free` ❌ | `false` ❌ | Tous les users ❌ |
| Negaoctet | `free` ❌ | `false` ❌ | Tous les users ❌ |

### Après le fix

| Source | Access Level | Is Blurred | Visible par |
|--------|-------------|-----------|-------------|
| Carbon Minds | `paid` ✅ | `true` ✅ | Workspaces assignés uniquement ✅ |
| Ecoinvent 3.11 | `paid` ✅ | `true` ✅ | Workspaces assignés uniquement ✅ |
| Ecobalyse | `paid` ✅ | `true` ✅ | Workspaces assignés uniquement ✅ |
| Roundarc | `paid` ✅ | `true` ✅ | Workspaces assignés uniquement ✅ |
| Negaoctet | `paid` ✅ | `true` ✅ | Workspaces assignés uniquement ✅ |

### Flow admin après le fix

1. Admin se connecte à la page **Sources Admin**
2. Admin voit les **5 nouvelles sources** avec `access_level = 'paid'` et `auto_detected = true`
3. Admin peut pour chaque source :
   - ✅ **Valider et passer en gratuit** : `UPDATE fe_sources SET access_level = 'free' WHERE source_name = 'Carbon Minds'`
   - ✅ **Assigner à des workspaces** : `INSERT INTO fe_source_workspace_assignments (...)`
   - ✅ **Laisser payant** : Les données restent floutées sauf pour les workspaces assignés

---

## 📝 Migration complète

**Fichier** : `supabase/migrations/20251013_fix_access_level_default_paid.sql`

```sql
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

CREATE OR REPLACE FUNCTION public.run_import_from_staging()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start timestamptz := now();
  v_invalid integer := 0;
  v_total integer := 0;
  v_inserted integer := 0;
  v_error_message text;
  v_missing_sources text[];
  v_algolia_task_id uuid := '419f86b4-4c35-4608-8a88-b8343a457a3a';
BEGIN
  -- ... (code existant jusqu'à la ligne 150) ...
  
  -- Vérification et auto-création des sources manquantes dans fe_sources
  BEGIN
    SELECT array_agg(DISTINCT s.source_name)
    INTO v_missing_sources
    FROM (
      SELECT DISTINCT "Source" as source_name 
      FROM temp_dedup 
      WHERE "Source" IS NOT NULL
    ) s
    LEFT JOIN public.fe_sources fs ON fs.source_name = s.source_name
    WHERE fs.source_name IS NULL;

    IF v_missing_sources IS NOT NULL AND array_length(v_missing_sources, 1) > 0 THEN
      RAISE NOTICE 'Création automatique de % nouvelles sources (paid): %', 
        array_length(v_missing_sources, 1), v_missing_sources;
      
      -- ✅ FIX: Utiliser 'paid' au lieu de 'free'
      INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
      SELECT DISTINCT "Source", 'paid', true, true
      FROM temp_dedup 
      WHERE "Source" = ANY(v_missing_sources)
      ON CONFLICT (source_name) DO NOTHING;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS v_error_message = MESSAGE_TEXT;
    PERFORM public.log_import_error('Gestion des sources', v_error_message, SQLERRM);
    -- Ne pas bloquer l'import si cette étape échoue
  END;

  -- ... (reste du code inchangé) ...
  
END;
$$;

-- ============================================================================
-- 4. Mettre à jour les sources récemment ajoutées (optionnel)
-- ============================================================================

-- Option A: Passer toutes les sources récentes en 'paid' (nécessite validation admin)
UPDATE public.fe_sources
SET access_level = 'paid'
WHERE source_name IN ('Carbon Minds', 'Ecoinvent 3.11', 'Ecobalyse', 'Roundarc', 'Negaoctet')
  AND auto_detected = true
  AND access_level = 'free';

-- Option B: Laisser ces sources en 'free' si elles ont été validées manuellement
-- (Ne rien faire, l'admin validera manuellement depuis l'interface)

-- ============================================================================
-- 5. Rebuilder la projection avec les nouveaux access_level
-- ============================================================================

SELECT public.rebuild_emission_factors_all_search();

-- ============================================================================
-- 6. Vérification finale
-- ============================================================================

DO $$
DECLARE
  v_free_sources int;
  v_paid_sources int;
  v_auto_detected_free int;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE access_level = 'free') as free_count,
    COUNT(*) FILTER (WHERE access_level = 'paid') as paid_count,
    COUNT(*) FILTER (WHERE access_level = 'free' AND auto_detected = true) as auto_free_count
  INTO v_free_sources, v_paid_sources, v_auto_detected_free
  FROM public.fe_sources;
  
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ Configuration access_level des sources:';
  RAISE NOTICE '   - Sources gratuites: %', v_free_sources;
  RAISE NOTICE '   - Sources payantes: %', v_paid_sources;
  RAISE NOTICE '   - Sources auto-détectées gratuites: %', v_auto_detected_free;
  
  IF v_auto_detected_free > 0 THEN
    RAISE WARNING '⚠️  % sources auto-détectées sont en "free" - elles devraient être validées par un admin', v_auto_detected_free;
  ELSE
    RAISE NOTICE '🎉 Toutes les sources auto-détectées sont en "paid" (nécessitent validation)';
  END IF;
  RAISE NOTICE '============================================';
END$$;
```

---

## 🔧 Choix à faire

### Question 1 : Que faire avec les 5 sources récentes ?

**Option A** : Les passer en `'paid'` (recommandé si non validées)
```sql
UPDATE public.fe_sources
SET access_level = 'paid'
WHERE source_name IN ('Carbon Minds', 'Ecoinvent 3.11', 'Ecobalyse', 'Roundarc', 'Negaoctet');
```

**Option B** : Les laisser en `'free'` (si déjà validées par l'admin)
- Ne rien faire dans la migration
- L'admin confirme manuellement depuis l'interface

### Question 2 : Notification à l'admin ?

**Option** : Ajouter une notification lorsqu'une nouvelle source est détectée
- Créer une table `admin_notifications`
- Trigger qui insère une notification quand `auto_detected = true`
- Badge de notification dans la page admin

---

## ✅ Checklist d'exécution

- [ ] Décider du sort des 5 sources récentes (Option A ou B)
- [ ] Créer et appliquer la migration `20251013_fix_access_level_default_paid.sql`
- [ ] Mettre à jour le fichier `20251013_add_error_handling_import.sql` (ligne 156)
- [ ] Rebuilder `emission_factors_all_search`
- [ ] Vérifier que les sources auto-détectées futures sont bien en `'paid'`
- [ ] Tester le flow admin de validation des sources
- [ ] Documenter le flow de validation dans la doc admin

---

## 📚 Documentation à créer

1. **Guide admin** : "Comment valider une nouvelle source"
   - Étape 1 : Aller sur la page Sources Admin
   - Étape 2 : Voir les sources avec `auto_detected = true`
   - Étape 3 : Décider si gratuite ou payante
   - Étape 4 : Si payante, assigner aux workspaces

2. **API documentation** : Endpoints pour gérer les sources
   - `PATCH /fe_sources/:id` → Modifier l'access_level
   - `POST /fe_source_workspace_assignments` → Assigner à un workspace

---

**Prêt à exécuter ?** Dis-moi quelle option tu préfères pour les 5 sources récentes, et je lance l'exécution !

