# Diagnostic: Doublons FR/EN dans emission_factors

**Date**: 30 septembre 2025  
**Sévérité**: ⚠️ CRITIQUE  
**Impact**: ~87% de la base de données

## Problème identifié

La table `emission_factors` contient des doublons systématiques dus à un import historique double:

### Statistiques globales
- **Records FR-only** (Contributeur rempli, Contributeur_en NULL): 182,852
- **Records EN-only** (Contributeur NULL, Contributeur_en rempli): 212,368  
- **Total records is_latest=true**: 452,340
- **Taux de duplication**: ~87% de la base

### Pattern identifié

Pour chaque facteur d'émission, il existe souvent 2 records:

1. **Record "FR"**: Colonnes FR remplies (`Contributeur`, `Type_de_données`), colonnes EN NULL
2. **Record "EN"**: Colonnes EN remplies (`Contributeur_en`, `Type_de_données_en`), colonnes FR NULL

**Exemple concret** (Kérosène jet A1 ou A):
- 42 records dans `staging_emission_factors`
- 84 records dans `emission_factors` (42 FR + 42 EN)
- 84 records dans `emission_factors_all_search`

### Cause racine

Import historique effectué 2 fois avec des mappings différents:
1. Premier import: mapping colonnes FR uniquement
2. Second import: mapping colonnes EN uniquement

Au lieu de mettre à jour les records existants, les 2 imports ont créé des records séparés.

## Impact

1. **Données fragmentées**: Les colonnes FR et EN sont réparties sur des records différents
2. **Doublons dans les projections**: `emission_factors_all_search` contient 2× les records  
3. **Recherche**: Résultats dupliqués dans Algolia
4. **Performance**: Base de données 2× plus volumineuse que nécessaire

## Solutions envisagées

### ❌ Option 1: Correction en masse (rejected)
```sql
UPDATE emission_factors ...
```
**Problème**: Timeout sur 395k records, trop volumineux pour une seule transaction

### ❌ Option 2: Correction par lots (complexe)
**Problème**: Risque d'inconsistance entre lots, nécessite gestion d'état

### ✅ Option 3: Fusion à la lecture (RECOMMANDÉE)
Modifier la fonction `rebuild_emission_factors_all_search()` pour fusionner automatiquement les paires FR/EN lors de la projection.

**Avantages**:
- Pas de migration lourde
- Correction immédiate dans `emission_factors_all_search`
- `emission_factors` reste intact (historique préservé)
- Réversible si nécessaire

## Solution retenue

Créer une VIEW intermédiaire qui fusionne les paires FR/EN, puis utiliser cette VIEW dans les fonctions de projection.

### Étapes

1. ✅ Créer `v_emission_factors_merged` VIEW
2. ✅ Modifier `rebuild_emission_factors_all_search()` pour utiliser la VIEW
3. ✅ Rebuild la projection
4. ✅ Vérifier les résultats
5. 🔄 Modifier les futurs imports pour éviter les doublons

## Prochaines actions

1. **Court terme**: Implémenter la VIEW de fusion
2. **Moyen terme**: Nettoyer `emission_factors` en arrière-plan (batches nocturnes)
3. **Long terme**: Modifier le processus d'import pour détecter et fusionner les doublons

## Fichiers concernés

- `supabase/functions/import-csv/index.ts` (à modifier pour éviter futurs doublons)
- `supabase/migrations/20250910_unify_projection_with_overlays.sql` (projection actuelle)
- Nouvelle migration à créer pour la VIEW


