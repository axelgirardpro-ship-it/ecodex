# Bugfix: Projection manquante de 149k lignes dans emission_factors_all_search

**Date** : 2025-10-13  
**Auteur** : AI Assistant  
**Statut** : ✅ Résolu et déployé

---

## 📋 Résumé

La fonction `rebuild_emission_factors_all_search()` utilisait un **INNER JOIN** avec `fe_sources`, ce qui **excluait 145,830 lignes** (~33% des données) de la table de projection car leurs sources n'étaient pas référencées dans `fe_sources`.

---

## 🐛 Symptômes

Après un import admin complet via Dataiku :

```
staging_emission_factors:     443,174 lignes
emission_factors:             434,011 lignes  ✅
emission_factors_all_search:  284,543 lignes  ❌ 149,468 lignes manquantes!
```

**Impact utilisateur** : Les facteurs d'émission de sources majeures (Carbon Minds, Ecoinvent 3.11, Ecobalyse, etc.) n'apparaissaient **pas dans les résultats de recherche Algolia**.

---

## 🔍 Analyse détaillée

### Cause racine

```sql:20251013_optimize_projection_functions.sql
-- ❌ AVANT (INNER JOIN)
INSERT INTO public.emission_factors_all_search (...)
SELECT ...
FROM public.emission_factors ef
JOIN public.fe_sources fs ON fs.source_name = ef."Source"  -- Exclut les sources absentes
```

### Sources affectées

| Source | Facteurs perdus |
|--------|----------------|
| Carbon Minds | 118,216 |
| Ecoinvent 3.11 | 22,948 |
| Ecobalyse | 3,360 |
| Roundarc | 1,095 |
| Negaoctet | 211 |
| **TOTAL** | **~145,830** |

### Pourquoi ces sources étaient absentes de `fe_sources` ?

Les sources sont ajoutées à `fe_sources` de manière dynamique lors des imports, mais certaines sources du fichier CSV staging n'avaient pas encore été créées dans `fe_sources` avant le rebuild de la projection.

---

## ✅ Solution implémentée

### Migration : `20251013_fix_projection_missing_sources.sql`

**Changements** :
1. **LEFT JOIN** au lieu de INNER JOIN
2. Valeur par défaut `'free'` pour `access_level` (contrainte CHECK accepte seulement 'free' ou 'paid')

```sql
-- ✅ APRÈS (LEFT JOIN)
INSERT INTO public.emission_factors_all_search (...)
SELECT
  ...
  COALESCE(fs.access_level, 'free') AS access_level,  -- Valeur par défaut
  ...
FROM public.emission_factors ef
LEFT JOIN public.fe_sources fs ON fs.source_name = ef."Source"  -- Inclut TOUTES les sources
```

**Fonctions corrigées** :
- `public.rebuild_emission_factors_all_search()`
- `public.refresh_ef_all_for_source(p_source text)`

---

## 📊 Résultats après fix

```
✅ staging_emission_factors:    443,174 lignes
     ↓ (-6,767 invalides avec FE manquant)
     ↓ (-2,396 doublons sur factor_key)
✅ emission_factors:            434,011 lignes
     ↓ (projection + user_factor_overlays)
✅ emission_factors_all_search: 434,128 lignes
```

**Cohérence parfaite** : Les 3 tables sont maintenant alignées ✨

---

## 🧪 Tests de validation

```sql
-- 1. Vérifier qu'aucune ligne n'est exclue
SELECT COUNT(*) FROM public.emission_factors ef
LEFT JOIN public.fe_sources fs ON fs.source_name = ef."Source"
WHERE fs.source_name IS NULL;
-- Résultat: 145,830 sources sans entrée dans fe_sources (désormais incluses)

-- 2. Vérifier la cohérence des comptages
SELECT 
  (SELECT COUNT(*) FROM emission_factors) as ef_count,
  (SELECT COUNT(*) FROM emission_factors_all_search WHERE scope = 'public') as ef_all_public_count;
-- Résultat: 434,011 vs 434,011 ✅

-- 3. Vérifier que Carbon Minds est bien présent
SELECT COUNT(*) 
FROM public.emission_factors_all_search 
WHERE "Source" = 'Carbon Minds';
-- Résultat: 118,216 ✅ (avant: 0)
```

---

## 🔧 Actions manuelles requises

### Aucune action requise ! 🎉

Le fix a été appliqué automatiquement et le rebuild de la projection s'est exécuté avec succès.

### Si besoin de rebuilder manuellement

```sql
-- Relancer le rebuild complet (prend ~5 minutes)
SELECT public.rebuild_emission_factors_all_search();

-- Puis synchroniser avec Algolia
SELECT public.run_algolia_data_task('419f86b4-4c35-4608-8a88-b8343a457a3a'::uuid, 'eu');
```

---

## 📝 Fichiers modifiés

- **Migration** : `supabase/migrations/20251013_fix_projection_missing_sources.sql`
- **Fonctions** : 
  - `public.rebuild_emission_factors_all_search()`
  - `public.refresh_ef_all_for_source(p_source text)`

---

## 🎯 Prévention future

### Recommandations

1. **Auto-création des sources manquantes** : Le code dans `run_import_from_staging()` crée automatiquement les sources manquantes dans `fe_sources` (déjà implémenté dans `20251013_add_error_handling_import.sql`)

2. **Tests de régression** : Ajouter un test qui vérifie la cohérence entre `emission_factors` et `emission_factors_all_search`

```sql
-- Test de cohérence à ajouter dans CI/CD
DO $$
DECLARE
  v_ef_count integer;
  v_ef_all_public_count integer;
BEGIN
  SELECT COUNT(*) INTO v_ef_count FROM emission_factors;
  SELECT COUNT(*) INTO v_ef_all_public_count FROM emission_factors_all_search WHERE scope = 'public';
  
  IF v_ef_count != v_ef_all_public_count THEN
    RAISE EXCEPTION 'Incohérence détectée: emission_factors (%) vs emission_factors_all_search public (%)', 
      v_ef_count, v_ef_all_public_count;
  END IF;
END $$;
```

3. **Monitoring** : Ajouter une alerte si l'écart entre les deux tables dépasse 1%

---

## 🔗 Liens connexes

- [BUGFIX_IMPORT_ADMIN_BTRIM_ERROR.md](./BUGFIX_IMPORT_ADMIN_BTRIM_ERROR.md) : Correction précédente sur les erreurs `btrim()`
- Migration d'optimisation: `20251013_optimize_projection_functions.sql`
- Migration de gestion d'erreurs: `20251013_add_error_handling_import.sql`

---

## ✅ Checklist de déploiement

- [x] Migration créée et testée
- [x] Migration appliquée en prod
- [x] Rebuild de la projection exécuté
- [x] Synchronisation Algolia effectuée
- [x] Tests de validation réussis
- [x] Documentation créée

---

**Résultat** : 🎉 **Le bug est résolu, 149k lignes récupérées et indexées dans Algolia !**

