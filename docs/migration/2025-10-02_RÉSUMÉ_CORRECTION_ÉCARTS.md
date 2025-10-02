# 🎯 RÉSUMÉ: Correction des écarts entre tables (2025-10-02)

## ✅ Problèmes résolus

### 1. Écart staging_emission_factors → emission_factors ⚠️ BUG CRITIQUE TROUVÉ ET CORRIGÉ

**Constat initial**: 
- `staging_emission_factors`: 295,806 records
- `emission_factors`: 284,426 records
- **Écart**: 11,380 records

**Explication initiale (INCORRECTE)**:
- 395 records invalides (sans FE ou sans Unité) → exclus ✅
- 10,985 doublons éliminés par déduplication `factor_key` → ❌ **DONT 5,732 FAUX POSITIFS !**

**🐛 BUG DÉCOUVERT**: 
Le `factor_key` utilisait `to_char(p_fe, 'FM999999999.############')` qui **arrondissait les décimales** :
- ❌ 0.000183 → "0"
- ❌ 0.461 → "0"  
- ❌ 1234.567 → "1235"

**Impact**: **52% de faux doublons** (5,732 records UNIQUES perdus !)

**✅ SOLUTION DÉPLOYÉE**:
- Migration `20251002_fix_factor_key_decimal_bug_v2.sql` appliquée
- `calculate_factor_key()` corrigée : utilise maintenant `p_fe::text`
- Validation : les 3 valeurs génèrent maintenant des clés différentes ✅

**Après prochain import**:
- Records récupérés : **+5,732**
- Total attendu : **290,158** (au lieu de 284,426)
- Vrais doublons restants : ~5,253 (déduplication légitime)

---

### 2. user_factor_overlays manquants dans emission_factors_all_search ✅ CORRIGÉ

**Constat initial**:
- `emission_factors`: 284,426 records
- `user_factor_overlays`: 117 records
- `emission_factors_all_search`: 284,426 records ❌ (devrait être 284,543)
- **Écart**: 117 records manquants (0% des overlays présents)

**Cause**:
La fonction `run_import_from_staging()` appelait `refresh_ef_all_for_source()` qui reconstruit source par source, mais ne garantissait pas l'inclusion de tous les overlays.

**Solution appliquée**:
1. ✅ Migration `20251002_auto_rebuild_all_search_on_import.sql` déployée
2. ✅ Modification de `run_import_from_staging()` pour appeler `rebuild_emission_factors_all_search()` (rebuild COMPLET)
3. ✅ Création de `validate_emission_factors_all_search()` pour monitoring continu

**Résultat APRÈS correction**:
```json
{
  "is_valid": true,
  "message": "Validation réussie: emission_factors_all_search est cohérent",
  "emission_factors_count": 284426,
  "user_factor_overlays_count": 117,
  "expected_total": 284543,
  "all_search_count": 284543,
  "public_count": 284426,
  "private_count": 117
}
```

✅ **VALIDÉ** - Les 117 overlays sont maintenant tous présents dans `emission_factors_all_search`

---

### 3. Mapping user_factor_overlays avec nouveaux ID ✅ VÉRIFIÉ

**Vérification**:
- ✅ Les `object_id` des overlays utilisent bien `overlay_id` (UUID)
- ✅ Le champ `scope` est bien 'private' pour les overlays
- ✅ Le champ `scope` est bien 'public' pour emission_factors
- ✅ Les 117 overlays sont correctement mappés avec les récents changements d'ID

---

## 📊 État final des tables

| Table | Count | Type | Status |
|-------|-------|------|--------|
| `staging_emission_factors` | 295,806 | Staging | ℹ️ Source |
| `emission_factors` | 284,426 | Production | ✅ Correct |
| `user_factor_overlays` | 117 | Production | ✅ Correct |
| `emission_factors_all_search` | **284,543** | Projection | ✅ **= 284,426 + 117** |
| └─ scope='public' | 284,426 | - | ✅ = emission_factors |
| └─ scope='private' | 117 | - | ✅ = user_factor_overlays |

---

## 🔧 Nouvelles fonctionnalités

### Fonction de validation automatique

```sql
-- Valider l'intégrité des données
SELECT * FROM public.validate_emission_factors_all_search();
```

Cette fonction peut être appelée à tout moment pour vérifier que:
- `emission_factors_all_search` = `emission_factors` + `user_factor_overlays`
- Les scopes sont correctement assignés
- Aucun record n'est manquant

### Import automatisé avec garantie d'intégrité

La fonction `run_import_from_staging()` retourne maintenant des métriques étendues:

```json
{
  "inserted": 284426,
  "invalid": 395,
  "sources": ["Base Carbone v23.6", "..."],
  "duration_ms": 45000,
  "rebuild_ms": 1500,
  "all_search_count": 284543,
  "user_overlays_included": 117
}
```

---

## 📋 Recommandations pour monitoring

### Validation quotidienne (recommandé)

```sql
-- Créer un cron job ou scheduled function
SELECT 
  CASE 
    WHEN (v->>'is_valid')::boolean THEN 'OK'
    ELSE 'ALERTE: ' || (v->>'message')
  END as status,
  v->>'all_search_count' as total,
  v->>'public_count' as public,
  v->>'private_count' as private
FROM (
  SELECT validate_emission_factors_all_search() as v
) sub;
```

### Alerte en cas d'écart

Si `is_valid = false`, relancer:
```sql
SELECT rebuild_emission_factors_all_search();
```

---

## 📚 Documentation créée

1. ✅ `/docs/migration/2025-10-02_analyse-doublons-elimination.md` - Analyse détaillée des doublons
2. ✅ `/docs/migration/2025-10-02_BUG_CRITIQUE_factor_key_fix.md` - **Documentation du bug critique** ⚠️
3. ✅ `/supabase/migrations/20251002_auto_rebuild_all_search_on_import.sql` - Migration auto-rebuild
4. ✅ `/supabase/migrations/20251002_fix_factor_key_decimal_bug_v2.sql` - **Migration critique déployée** 🔧
5. ✅ Ce résumé (`2025-10-02_RÉSUMÉ_CORRECTION_ÉCARTS.md`)

---

## ⚠️ ACTION IMMÉDIATE REQUISE

### RÉIMPORTER LES DONNÉES

Pour bénéficier du fix du bug critique `factor_key`, vous devez **réimporter** :

```sql
SELECT public.run_import_from_staging();
```

**Résultat attendu** :
```json
{
  "inserted": 290158,  // +5,732 vs avant
  "invalid": 395,
  "all_search_count": 290275,  // +5,732 vs avant
  "user_overlays_included": 117
}
```

---

## ✨ Conclusion

Tous les problèmes identifiés sont **RÉSOLUS**:

1. ⚠️ **BUG CRITIQUE découvert** : factor_key arrondissait les décimales (5,732 faux doublons)
   - ✅ **CORRIGÉ** via migration `20251002_fix_factor_key_decimal_bug_v2.sql`
   - ⚠️ **RÉIMPORT NÉCESSAIRE** pour récupérer les 5,732 records perdus
2. ✅ Overlays manquants: **CORRIGÉ** (rebuild automatique)
3. ✅ Mapping des ID: **VÉRIFIÉ** (conforme aux changements récents)

Le système est maintenant **robuste**, **auto-vérifié** et **précis** à chaque import. 🎉

**Gain net après réimport** : **+5,732 facteurs d'émission uniques récupérés** ! 🚀

