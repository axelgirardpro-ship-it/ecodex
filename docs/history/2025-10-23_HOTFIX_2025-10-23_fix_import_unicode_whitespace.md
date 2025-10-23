# HOTFIX - Fix import FE avec espaces Unicode (U+202F)

**Date** : 2025-10-23  
**Type** : Hotfix  
**Impact** : Correction erreur import depuis Dataiku avec espaces insécables

## 🐛 Problème identifié

La fonction `run_import_from_staging()` échouait lors de l'import depuis Dataiku avec l'erreur :

```json
{
  "success": false,
  "error": "Erreur préparation: invalid input syntax for type numeric: \"2 051\"",
  "error_detail": "Erreur préparation: invalid input syntax for type numeric: \"2 051\""
}
```

### Cause racine

Le champ `FE` de la table `staging_emission_factors` contenait des valeurs avec **espaces fines insécables** (Unicode U+202F, hex `e280af`) au lieu d'espaces normaux :
- Exemple : `"2 051"` → hex `32e280af303531`
- 20 valeurs affectées sur 626 104 records

### Record exemple
- **Nom** : `SP-GW /GGSN - Réseaux FAI`
- **Source** : `Negaoctet`
- **Valeur FE** : `"2 051"` (avec U+202F)
- **Secteur** : Composants informatiques et électroniques

## 🔍 Analyse technique

Le problème était dans la fonction `run_import_from_staging()` qui utilisait :
```sql
EXECUTE 'CREATE TEMPORARY TABLE temp_prepared AS SELECT ... 
  regexp_replace(btrim("FE"), ''\\s+'', '''', ''g'')::numeric ...'
```

Dans un bloc `EXECUTE` (SQL dynamique), l'échappement de la regex `\s+` était incorrect, empêchant la suppression des espaces Unicode.

## ✅ Solution appliquée

### Migration : `20251023_fix_fe_whitespace_in_dynamic_sql.sql`

**Changement principal** : Remplacer `EXECUTE` par un vrai `CREATE TEMPORARY TABLE` sans SQL dynamique.

```sql
-- ❌ AVANT (avec EXECUTE - problème d'échappement)
EXECUTE 'CREATE TEMPORARY TABLE temp_prepared AS SELECT ...
  regexp_replace(btrim("FE"), ''\\\\s+'', '''', ''g'')::numeric ...';

-- ✅ APRÈS (sans EXECUTE - échappement correct)
CREATE TEMPORARY TABLE temp_prepared AS
  SELECT ...
    CASE 
      WHEN "FE" IS NOT NULL AND btrim("FE") != '' 
      THEN regexp_replace(btrim("FE"), '\s+', '', 'g')::numeric 
      ELSE NULL 
    END AS "FE"
  FROM public.staging_emission_factors;
```

### Bénéfices
- ✅ Gestion correcte de TOUS les types d'espaces Unicode (`\s+` : U+0020, U+00A0, U+202F, etc.)
- ✅ Pas de problème d'échappement dans le SQL dynamique
- ✅ Code plus lisible et maintenable

## 📊 Résultats après correction

| Métrique | Avant | Après |
|----------|-------|-------|
| Records avec whitespace | 20 | 20 |
| Records convertissables | 0 | **626 104** ✅ |
| Import réussi | ❌ | ✅ |

### Test de validation

```sql
-- Tous les records peuvent maintenant être convertis
SELECT 
  COUNT(*) as total_rows,
  COUNT(CASE 
    WHEN "FE" IS NOT NULL AND btrim("FE") != '' 
    THEN regexp_replace(btrim("FE"), '\s+', '', 'g')::numeric 
    ELSE NULL 
  END) as successfully_converted
FROM staging_emission_factors;
```

**Résultat** : 626 104 / 626 104 (100% ✅)

## 🧪 Tests effectués

1. ✅ Test de conversion sur valeur problématique : `"2 051"` → `2051`
2. ✅ Test de conversion sur l'ensemble de la table : 100% succès
3. ✅ Test d'import complet depuis Dataiku : Succès

## 📝 Fichiers modifiés

- **Migration** : `supabase/migrations/20251023_fix_fe_whitespace_in_dynamic_sql.sql`
- **Fonction mise à jour** : `public.run_import_from_staging()`

## 🔗 Liens connexes

- Migration similaire précédente : `20251014_fix_fe_conversion_with_spaces.sql` (avait le problème d'échappement)
- Documentation Unicode : [U+202F Narrow No-Break Space](https://www.compart.com/en/unicode/U+202F)

## 🎯 Actions de suivi

- [ ] Valider que Dataiku n'envoie plus d'espaces insécables dans les futures versions
- [ ] Considérer un nettoyage des données côté Dataiku avant export
- [ ] Documenter les types d'espaces gérés pour les futurs développeurs

---

**Status** : ✅ Résolu et testé  
**Déploiement** : Migration appliquée avec succès  
**Impact** : Import depuis Dataiku fonctionnel

