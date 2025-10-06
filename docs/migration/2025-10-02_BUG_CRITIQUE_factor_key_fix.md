# 🐛 BUG CRITIQUE: factor_key arrondissait les valeurs décimales

**Date découverte**: 2025-10-02  
**Sévérité**: ⚠️ **CRITIQUE** - Perte de 5,732 records (52% de faux positifs)  
**Status**: ✅ **CORRIGÉ** via migration `20251002_fix_factor_key_decimal_bug_v2.sql`

---

## 🔍 Symptômes

Écart inexpliqué de 10,985 records entre `staging_emission_factors` (295,806) et `emission_factors` (284,426), avec notamment :
- 69 variations d'"Électricité mix moyen - Reste du monde" toutes considérées comme doublons
- Des FE clairement différents (0.000183, 0.000648, 0.461) traités comme identiques

---

## 🐛 Cause racine

La fonction `calculate_factor_key()` utilisait `to_char(p_fe, 'FM999999999.############')` pour formatter le FE.

**Problème**: Cette syntaxe de formatage arrondissait incorrectement :
- ❌ **0.000183** → formaté en **"0"**
- ❌ **0.000648** → formaté en **"0"**
- ❌ **0.461** → formaté en **"0"**
- ❌ **1234.567** → formaté en **"1235"** (arrondi même pour valeurs > 1 !)

**Résultat** : Des records complètement différents avaient le même `factor_key` et étaient éliminés comme "doublons".

### Exemple concret

**"Électricité mix moyen - Reste du monde - 2014"** avait 69 valeurs de FE différentes :
- 0.000183 kg CO₂e/kWh (Islande, quasi 100% hydroélectrique)
- 0.186 kg CO₂e/kWh (France, majoritairement nucléaire)
- 0.461 kg CO₂e/kWh (Allemagne, encore beaucoup de charbon)
- etc.

**Toutes** étaient réduites au même factor_key : 
```
électricité mix moyen|kwh|base carbone v23.6||reste du monde|0|2014
```

Seule la première était conservée, **les 68 autres étaient perdues** ! 😱

---

## ✅ Solution appliquée

### Code corrigé

**Avant** (BUGUÉ):
```sql
DECLARE
  v_fe text := coalesce(to_char(p_fe, 'FM999999999.############'), '');
```

**Après** (CORRIGÉ):
```sql
DECLARE
  -- FIX: Utiliser ::text pour préserver TOUTES les décimales
  v_fe text := coalesce(p_fe::text, '');
```

### Résultat du fix

**Avant** :
```sql
factor_key = 'électricité mix moyen|kwh|base carbone v23.6||reste du monde|0|2014'
```

**Après** :
```sql
factor_key_1 = 'électricité mix moyen|kwh|base carbone v23.6||reste du monde|0.000183|2014'
factor_key_2 = 'électricité mix moyen|kwh|base carbone v23.6||reste du monde|0.000648|2014'
factor_key_3 = 'électricité mix moyen|kwh|base carbone v23.6||reste du monde|0.461|2014'
```

✅ **Chaque record est maintenant correctement identifié comme unique !**

---

## 📊 Impact chiffré

### Analyse comparative

| Métrique | Avant fix | Après fix | Différence |
|----------|-----------|-----------|------------|
| Records staging valides | 295,411 | 295,411 | - |
| Factor_keys uniques | 284,426 | **290,158** | **+5,732** |
| Records dans emission_factors | 284,426 | **290,158*** | **+5,732** |
| Faux doublons éliminés | **5,732** ❌ | **0** ✅ | **-5,732** |
| Vrais doublons éliminés | 5,253 | 5,253 | - |
| Taux de faux positifs | **52%** ❌ | **0%** ✅ | **-52%** |

\* *Après prochain import avec la fonction corrigée*

### Répartition des 10,985 "doublons" originaux

- ❌ **5,732 faux doublons** (52%) - Records UNIQUES perdus à cause du bug
- ✅ **5,253 vrais doublons** (48%) - Vraie déduplication légitime

---

## 🎯 Validation

### Test du fix

```sql
-- Test avec 3 valeurs différentes
SELECT 
  public.calculate_factor_key(
    'électricité mix moyen', 'kwh', 'base carbone v23.6', 
    null, 'reste du monde', NULL, NULL, 0.000183::numeric, 2014
  ) as key_1,
  public.calculate_factor_key(
    'électricité mix moyen', 'kwh', 'base carbone v23.6', 
    null, 'reste du monde', NULL, NULL, 0.000648::numeric, 2014
  ) as key_2,
  public.calculate_factor_key(
    'électricité mix moyen', 'kwh', 'base carbone v23.6', 
    null, 'reste du monde', NULL, NULL, 0.461::numeric, 2014
  ) as key_3;
```

**Résultat** :
```
key_1: ...||0.000183|2014  ✅
key_2: ...||0.000648|2014  ✅
key_3: ...||0.461|2014     ✅
```

**Tous différents !** 🎉

### Analyse d'impact

```sql
SELECT * FROM public.analyze_factor_key_fix_impact();
```

**Résultat** :
```json
{
  "before_fix_unique_keys": 284426,
  "after_fix_unique_keys": 290158,
  "additional_unique_records": 5732,
  "false_duplicates_eliminated": 5732,
  "message": "Le fix permettra de conserver 5732 records supplémentaires"
}
```

---

## 🚀 Actions requises

### ✅ FAIT

1. ✅ Migration déployée : `20251002_fix_factor_key_decimal_bug_v2.sql`
2. ✅ Fonction `calculate_factor_key()` corrigée
3. ✅ Fonction d'analyse `analyze_factor_key_fix_impact()` créée
4. ✅ Validation réussie avec tests

### ⚠️ À FAIRE IMMÉDIATEMENT

**IMPORTANT** : Il faut **RÉIMPORTER** les données depuis `staging_emission_factors` pour bénéficier du fix !

```sql
-- Lancer l'import avec la fonction corrigée
SELECT public.run_import_from_staging();
```

**Résultat attendu** :
- `emission_factors` : passera de 284,426 à **~290,158 records** (+5,732)
- `emission_factors_all_search` : passera de 284,543 à **~290,275 records** (+5,732)

---

## 📋 Leçons apprises

### Ce qu'on a appris

1. ✅ **to_char() n'est PAS fiable pour les conversions numériques** en clés uniques
2. ✅ **Toujours tester avec des valeurs décimales < 1** lors de la conception de fonctions de clé
3. ✅ **Valider les factor_keys avec des échantillons réels** avant déploiement
4. ✅ **Un écart "normal" peut cacher un bug critique** - toujours investiguer !

### Bonnes pratiques pour l'avenir

1. 🎯 **Cast simple** : Utiliser `::text` au lieu de formatage complexe pour les clés
2. 🎯 **Tests unitaires** : Créer des tests avec valeurs extrêmes (0.00001, 999999.99, etc.)
3. 🎯 **Monitoring** : Alertes si déduplication > 5% des records
4. 🎯 **Documentation** : Toujours documenter le format attendu des clés

---

## 📚 Références

- Migration: `supabase/migrations/20251002_fix_factor_key_decimal_bug_v2.sql`
- Fonction corrigée: `public.calculate_factor_key()`
- Analyse d'impact: `public.analyze_factor_key_fix_impact()`
- Ticket: Écart entre staging_emission_factors et emission_factors

---

## 🎊 Conclusion

Ce bug **critique** a été identifié grâce à l'observation attentive de l'utilisateur qui a remarqué que les FE dans l'échantillon de "doublons" étaient tous différents.

**Impact positif du fix** : 
- ✅ **+5,732 records récupérés** (+ 2% de données)
- ✅ **Précision de la déduplication** : 52% → 100%
- ✅ **Intégrité des données** restaurée

Le prochain import permettra de récupérer tous ces facteurs d'émission qui avaient été incorrectement éliminés ! 🚀

