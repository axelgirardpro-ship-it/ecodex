# Bugfix : Synchronisation fe_sources lors des imports

**Date**: 2025-10-13  
**Migration**: `20251013_fix_fe_sources_sync.sql`  
**Auteur**: System  
**Statut**: ✅ Résolu

---

## 🔴 Problème

### Symptômes

- **145,830 facteurs d'émission** (Carbon Minds, Ecoinvent 3.11, Ecobalyse, Roundarc, Negaoctet) n'avaient pas leur source enregistrée dans la table `fe_sources`
- Les imports admin et utilisateur ne créaient pas automatiquement les sources manquantes dans `fe_sources`
- La projection `emission_factors_all_search` perdait des enregistrements lors du rebuild (284,543 au lieu de 434,011)

### Cause racine

**Incohérence dans les contraintes `access_level`** :

1. **Table `fe_sources`** :
   ```sql
   access_level CHECK (access_level IN ('free', 'paid'))
   ```

2. **Trigger `auto_detect_fe_sources()`** (ligne 13) :
   ```sql
   INSERT INTO public.fe_sources (source_name, access_level, ...)
   VALUES (NEW."Source", 'standard', ...)  -- ❌ INVALIDE !
   ```

3. **Fonction `run_import_from_staging()`** (ligne 156) :
   ```sql
   INSERT INTO public.fe_sources (source_name, access_level, ...)
   SELECT DISTINCT "Source", 'standard', ...  -- ❌ INVALIDE !
   ```

Le CHECK constraint de `fe_sources` n'acceptait que `'free'` ou `'paid'`, mais le code tentait d'insérer `'standard'`, causant des échecs silencieux d'insertion.

---

## ✅ Solution

### 1. Correction du trigger `auto_detect_fe_sources()`

**Avant** :
```sql
INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
VALUES (NEW."Source", 'standard', true, true)  -- ❌
ON CONFLICT (source_name) DO NOTHING;
```

**Après** :
```sql
INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
VALUES (NEW."Source", 'free', true, true)  -- ✅
ON CONFLICT (source_name) DO NOTHING;
```

### 2. Synchronisation des sources manquantes

Ajout de toutes les sources existantes dans `emission_factors` :

```sql
INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
SELECT DISTINCT 
  ef."Source" as source_name,
  'free' as access_level,
  true as is_global,
  true as auto_detected
FROM public.emission_factors ef
LEFT JOIN public.fe_sources fs ON fs.source_name = ef."Source"
WHERE fs.source_name IS NULL
  AND ef."Source" IS NOT NULL
ON CONFLICT (source_name) DO NOTHING;
```

### 3. Ajout d'un trigger pour les imports utilisateur

Création de `auto_detect_fe_sources_user()` pour synchroniser également les sources des imports utilisateur (table `user_factor_overlays`) :

```sql
CREATE OR REPLACE FUNCTION public.auto_detect_fe_sources_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
  VALUES (NEW."Source", 'free', true, true)
  ON CONFLICT (source_name) DO NOTHING;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_detect_sources_user_trigger
AFTER INSERT ON public.user_factor_overlays
FOR EACH ROW
WHEN (NEW."Source" IS NOT NULL)
EXECUTE FUNCTION public.auto_detect_fe_sources_user();
```

### 4. Correction de `run_import_from_staging()`

Mise à jour de la fonction pour utiliser `'free'` au lieu de `'standard'` :

```sql
-- Ligne 156 (ancienne version)
INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
SELECT DISTINCT "Source", 'standard', true, true  -- ❌

-- Ligne 156 (nouvelle version)
INSERT INTO public.fe_sources (source_name, access_level, is_global, auto_detected)
SELECT DISTINCT "Source", 'free', true, true  -- ✅
```

---

## 📊 Résultats

### Avant le fix

| Métrique | Valeur |
|----------|--------|
| Sources dans `emission_factors` | 32 sources uniques |
| Sources dans `fe_sources` | 46 sources (dont 14 anciennes/invalides) |
| **Sources manquantes** | **5 sources majeures** |
| Facteurs sans source | **145,830 facteurs** (33%) |
| Lignes dans `emission_factors_all_search` | 284,543 ❌ |

**Sources manquantes critiques** :
- Carbon Minds : 118,216 facteurs ❌
- Ecoinvent 3.11 : 22,948 facteurs ❌
- Ecobalyse : 3,360 facteurs ❌
- Roundarc : 1,095 facteurs ❌
- Negaoctet : 211 facteurs ❌

### Après le fix

| Métrique | Valeur |
|----------|--------|
| Sources dans `emission_factors` | 32 sources uniques |
| Sources dans `fe_sources` | **51 sources** ✅ |
| **Sources manquantes** | **0** ✅ |
| Facteurs sans source | **0** ✅ |
| Lignes dans `emission_factors_all_search` | **434,128** ✅ |

**Taux de récupération** : +149,585 lignes (+52.5%) 🎉

---

## 🔧 Fichiers modifiés

1. **`supabase/migrations/20251013_fix_fe_sources_sync.sql`** (créée)
   - Correction des triggers
   - Synchronisation des sources
   - Mise à jour de `run_import_from_staging()`

2. **`supabase/migrations/20251013_add_error_handling_import.sql`** (modifiée)
   - Ligne 156 : `'standard'` → `'free'`

---

## 🧪 Tests de validation

### Test 1 : Vérifier qu'aucune source ne manque

```sql
SELECT COUNT(*) as sources_manquantes
FROM (
  SELECT DISTINCT "Source" FROM public.emission_factors WHERE "Source" IS NOT NULL
  UNION
  SELECT DISTINCT "Source" FROM public.user_factor_overlays WHERE "Source" IS NOT NULL
) all_sources
LEFT JOIN public.fe_sources fs ON fs.source_name = all_sources."Source"
WHERE fs.source_name IS NULL;
```

**Résultat attendu** : `0`

### Test 2 : Compter les lignes dans les projections

```sql
SELECT 
  (SELECT COUNT(*) FROM public.emission_factors) as ef_count,
  (SELECT COUNT(*) FROM public.emission_factors_all_search) as ef_all_count,
  (SELECT COUNT(*) FROM public.fe_sources) as fe_sources_count;
```

**Résultat attendu** :
- `ef_count` : ~434,011
- `ef_all_count` : ~434,128 (inclut les user overlays)
- `fe_sources_count` : >= 32 (au minimum autant que de sources dans `emission_factors`)

### Test 3 : Vérifier que les triggers fonctionnent

```sql
-- Insérer un facteur test avec une nouvelle source
INSERT INTO public.emission_factors ("ID_FE", "Source", "Nom", "FE", "Unité donnée d'activité")
VALUES (gen_random_uuid()::text, 'Test Source 2025', 'Test Factor', 1.0, 'kg CO2e');

-- Vérifier que la source a été créée automatiquement
SELECT * FROM public.fe_sources WHERE source_name = 'Test Source 2025';
```

**Résultat attendu** : 1 ligne avec `access_level = 'free'`

---

## 🚀 Prochaines étapes

### Recommandations

1. **Monitoring** : Ajouter une alerte si des sources manquent dans `fe_sources`
2. **Documentation** : Mettre à jour la doc des imports pour spécifier que les sources sont auto-créées avec `access_level = 'free'`
3. **Tests automatisés** : Ajouter des tests CI/CD pour vérifier la synchronisation `emission_factors` ↔ `fe_sources`

### Migrations futures à éviter

❌ **Ne jamais** :
- Changer les CHECK constraints sur `access_level` sans vérifier tous les triggers
- Utiliser des valeurs hardcodées (`'standard'`, `'premium'`) sans vérifier les contraintes
- Modifier `fe_sources` sans tester l'impact sur les projections

✅ **Toujours** :
- Vérifier la cohérence entre les tables `fe_sources`, `emission_factors`, et `emission_factors_all_search`
- Tester les triggers après chaque modification de schéma
- Utiliser `LEFT JOIN` au lieu de `JOIN` pour les projections (pour éviter de perdre des données)

---

## 📚 Références

- Migration initiale : `20250805131156_b1ae4b92-6555-4287-94b2-3df7bcd69e54.sql`
- Trigger original : `20250805131218_fbca0526-6d93-45ed-8da4-88b155f0160c.sql`
- Fix projection : `20251013_fix_projection_missing_sources.sql`
- Fix sources sync : `20251013_fix_fe_sources_sync.sql` (cette migration)

---

## ✅ Checklist de validation

- [x] Trigger `auto_detect_fe_sources()` corrigé
- [x] Trigger `auto_detect_fe_sources_user()` créé
- [x] Fonction `run_import_from_staging()` corrigée
- [x] Sources manquantes synchronisées (145,830 facteurs récupérés)
- [x] Projection `emission_factors_all_search` rebuilée (434,128 lignes)
- [x] Tests de validation passés
- [x] Documentation créée
- [x] Migration appliquée en production

**Status final** : ✅ **RÉSOLU** - Toutes les sources sont maintenant synchronisées et les futurs imports créeront automatiquement les sources manquantes.

