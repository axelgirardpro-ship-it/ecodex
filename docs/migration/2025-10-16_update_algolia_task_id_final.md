# Mise à jour du Task ID Algolia - 16 octobre 2025

## 🎯 Objectif

Remplacement complet de l'ancien Task ID Algolia par le nouveau dans tout le flow d'import admin.

## 📊 Détails du changement

| Élément | Ancienne valeur | Nouvelle valeur |
|---------|----------------|-----------------|
| **Task ID Algolia** | `55278ecb-f8dc-43d8-8fe6-aff7057b69d0` | `914124fb-141d-4239-aeea-784bc5b24f41` |
| **Date de mise à jour** | 16 octobre 2025 | - |
| **Scope** | Flow d'import admin complet | - |

## 🔄 Fichiers modifiés

### 1. Migrations SQL (9 fichiers)

Tous les fichiers de migration SQL contenant des appels à `run_algolia_data_task` ont été mis à jour :

1. ✅ `supabase/migrations/20250909_fix_run_import_from_staging_eu_task.sql`
2. ✅ `supabase/migrations/20250909_hook_import_users_and_admin_algolia.sql`
3. ✅ `supabase/migrations/20251001_refonte_import_admin.sql`
4. ✅ `supabase/migrations/20251002_auto_rebuild_all_search_on_import.sql`
5. ✅ `supabase/migrations/20251013_add_error_handling_import.sql`
6. ✅ `supabase/migrations/20251013_fix_fe_sources_sync.sql`
7. ✅ `supabase/migrations/20251013_fix_run_import_staging_numeric_types.sql`
8. ✅ `supabase/migrations/20251014_fix_fe_conversion_with_spaces.sql`
9. ✅ `supabase/migrations/20251015_add_algolia_score_fields.sql`

**Total** : 10 occurrences remplacées dans les fichiers de migration

### 2. Fonction PostgreSQL

✅ **`public.run_import_from_staging()`**
- Fonction mise à jour via MCP Supabase
- Migration appliquée : `20251016_update_algolia_task_id.sql`
- Ligne modifiée :
  ```sql
  -- Avant
  PERFORM public.run_algolia_data_task('55278ecb-f8dc-43d8-8fe6-aff7057b69d0'::uuid, 'eu');
  
  -- Après
  PERFORM public.run_algolia_data_task('914124fb-141d-4239-aeea-784bc5b24f41'::uuid, 'eu');
  ```

## ✅ Validation

### Vérification des fichiers de migration

```bash
# Nouveau Task ID présent (10 occurrences)
grep -r "914124fb-141d-4239-aeea-784bc5b24f41" supabase/migrations/ | wc -l
# Résultat : 10

# Ancien Task ID supprimé (0 occurrence)
grep -r "55278ecb-f8dc-43d8-8fe6-aff7057b69d0" supabase/migrations/ | wc -l
# Résultat : 0
```

### Vérification de la fonction PostgreSQL

```sql
-- Vérifier le nouveau Task ID dans les fonctions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_definition LIKE '%914124fb-141d-4239-aeea-784bc5b24f41%';

-- Résultat :
-- routine_name: run_import_from_staging
-- routine_type: FUNCTION
```

```sql
-- Vérifier l'absence de l'ancien Task ID
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_definition LIKE '%55278ecb-f8dc-43d8-8fe6-aff7057b69d0%';

-- Résultat : [] (aucune occurrence)
```

## 🔍 Impact

### Composants affectés

1. **Import admin** : Tous les imports admin utiliseront désormais le nouveau Task ID
2. **Synchronisation Algolia** : Les tâches de synchronisation vers Algolia utiliseront le nouveau Task ID
3. **Historique des migrations** : Toutes les migrations historiques reflètent le nouveau Task ID

### Comportement fonctionnel

- ✅ **Pas de breaking change** : La structure de l'appel reste identique
- ✅ **Rétrocompatibilité** : Les imports en cours ne sont pas affectés
- ✅ **Cohérence** : Un seul Task ID utilisé dans tout le système

## 🚀 Déploiement

### Étapes réalisées

1. ✅ Remplacement dans tous les fichiers SQL de migration (9 fichiers)
2. ✅ Mise à jour de la fonction `run_import_from_staging()` via MCP Supabase
3. ✅ Création de la migration `20251016_update_algolia_task_id.sql`
4. ✅ Application de la migration sur la base de données
5. ✅ Validation complète (fichiers + base de données)

### Commande de vérification

```sql
-- Tester la fonction mise à jour
SELECT public.run_import_from_staging();
```

## 📚 Documentation associée

- **Migration précédente** : `docs/migration/2025-10-15_update_algolia_task_id.md`
- **Migration scores Algolia** : `docs/migration/2025-10-15_algolia_score_fields.md`
- **Résumé remplacement Task ID** : `docs/migration/TASK_ID_REPLACEMENT_SUMMARY.md`

## 🎯 Résultat final

✅ **Ancien Task ID** : `55278ecb-f8dc-43d8-8fe6-aff7057b69d0` - **0 occurrence** (supprimé)  
✅ **Nouveau Task ID** : `914124fb-141d-4239-aeea-784bc5b24f41` - **11 occurrences** (actif)

### Répartition des occurrences

| Emplacement | Occurrences |
|-------------|-------------|
| Fichiers de migration SQL | 10 |
| Fonction `run_import_from_staging()` | 1 |
| **TOTAL** | **11** |

## 🔐 Sécurité

- ✅ Aucune donnée utilisateur affectée
- ✅ Aucune interruption de service
- ✅ Changement transparent pour les utilisateurs
- ✅ Traçabilité complète via les migrations

## ⚡ Performance

- ✅ Aucun impact sur les performances
- ✅ Aucune modification de la logique métier
- ✅ Simple changement d'identifiant UUID

---

**Auteur** : Migration automatique via MCP Supabase  
**Date** : 16 octobre 2025  
**Statut** : ✅ Complété et validé

