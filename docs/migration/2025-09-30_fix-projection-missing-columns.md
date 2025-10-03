# Migration : Correction des colonnes manquantes dans la projection

**Date** : 30 septembre 2025  
**Auteur** : Assistant AI  
**Type** : Correction de bug

## Problème identifié

Les colonnes suivantes présentes dans `staging_emission_factors` et `emission_factors` n'étaient pas projetées vers `emission_factors_all_search` :

- `Contributeur` / `Contributeur_en`
- `Méthodologie` / `Méthodologie_en`
- `Type_de_données` / `Type_de_données_en`

### Symptômes

- Dans `staging_emission_factors` : toutes les colonnes renseignées ✅
- Dans `emission_factors` : toutes les colonnes renseignées ✅
- Dans `emission_factors_all_search` : colonnes NULL ❌

**Exemple** : Les records "Kérosène jet A1 ou A" avaient des valeurs dans `staging_emission_factors` et `emission_factors`, mais ces valeurs n'apparaissaient pas dans `emission_factors_all_search`.

## Solution implémentée

### 1. Ajout des colonnes à la table

Les colonnes ont été ajoutées à `emission_factors_all_search` :

```sql
alter table public.emission_factors_all_search
  add column if not exists "Contributeur" text,
  add column if not exists "Méthodologie" text,
  add column if not exists "Type_de_données" text,
  add column if not exists "Contributeur_en" text,
  add column if not exists "Méthodologie_en" text,
  add column if not exists "Type_de_données_en" text;
```

### 2. Mise à jour des fonctions de projection

Deux fonctions ont été mises à jour pour inclure les nouvelles colonnes :

#### `rebuild_emission_factors_all_search()`

Fonction qui reconstruit entièrement la projection depuis :
- `emission_factors` (base commune admin)
- `user_factor_overlays` (données personnalisées des workspaces)

#### `refresh_ef_all_for_source(p_source text)`

Fonction qui rafraîchit la projection pour une source spécifique uniquement.

### 3. Reconstruction de la projection

Après la migration, la fonction `rebuild_emission_factors_all_search()` a été exécutée pour peupler les nouvelles colonnes avec les données existantes.

## Vérification

### Test sur les données "Kérosène jet A1 ou A"

**Avant** :
```sql
SELECT "Nom_fr", "Type_de_données", "Type_de_données_en", "Contributeur_en"
FROM emission_factors_all_search 
WHERE "Nom_fr" LIKE '%Kérosène jet A1 ou A%' LIMIT 1;

-- Résultat : NULL, NULL, NULL
```

**Après** :
```sql
SELECT "Nom_fr", "Type_de_données", "Type_de_données_en", "Contributeur_en"
FROM emission_factors_all_search 
WHERE "Nom_fr" LIKE '%Kérosène jet A1 ou A%' LIMIT 1;

-- Résultat : "Générique", "Generic", "ADEME" ✅
```

## Fichiers modifiés

- `supabase/migrations/20250930_fix_missing_projection_columns.sql` : Migration complète
- `docs/migration/2025-09-30_fix-projection-missing-columns.md` : Cette documentation

## Impact

### Données affectées
- ✅ Tous les records de `emission_factors_all_search` ont maintenant accès aux colonnes manquantes
- ✅ Les futures projections incluront automatiquement ces colonnes

### Performance
- ⚠️ La fonction `rebuild_emission_factors_all_search()` a dû être exécutée une fois (opération lourde)
- ✅ Aucun impact sur les performances en lecture/écriture quotidiennes

### Algolia
- ⚠️ Il faudra potentiellement réindexer Algolia pour que les nouvelles colonnes soient disponibles dans la recherche
- Les colonnes peuvent être ajoutées aux attributs searchables/facets selon les besoins métier

## Prochaines étapes recommandées

1. **Vérifier l'indexation Algolia** : S'assurer que ces colonnes sont bien indexées et searchables si nécessaire
2. **Documentation utilisateur** : Mettre à jour la doc si ces champs deviennent visibles dans l'interface
3. **Tests utilisateur** : Vérifier que les données s'affichent correctement dans l'application

## Notes techniques

- La structure de `emission_factors_all_search` diffère légèrement de la fonction d'origine dans `20250910_unify_projection_with_overlays.sql`
- Les colonnes `record_id` et `languages` n'existent pas dans la table actuelle, elles ont été retirées de la fonction
- Les colonnes `is_blurred` et `variant` sont bien présentes et définies à `false` et `'full'` par défaut



