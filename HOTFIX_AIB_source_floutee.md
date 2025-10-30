# HOTFIX - Source AIB Floutée à Tort

**Date** : 30 octobre 2025  
**Statut** : ✅ Résolu  
**Gravité** : Moyenne  
**Impact** : 2689 enregistrements affichés comme premium alors qu'ils sont gratuits

## 🔴 Problème Identifié

La source **AIB** était affichée comme floutée dans l'interface utilisateur alors qu'elle devrait être accessible gratuitement.

### Diagnostic

Investigation via MCP Supabase :

1. **Configuration dans `fe_sources`** : ✅ Correcte
   ```sql
   SELECT * FROM fe_sources WHERE source_name = 'AIB';
   -- Résultat: access_level = 'free', is_global = true
   ```

2. **Données dans `emission_factors_all_search`** : ❌ Obsolètes
   ```sql
   SELECT access_level, COUNT(*) FROM emission_factors_all_search 
   WHERE "Source" = 'AIB' GROUP BY access_level;
   -- Résultat AVANT FIX: access_level = 'paid', count = 2689
   ```

### Cause Racine

Les données dans la table de projection `emission_factors_all_search` n'avaient pas été rafraîchies après qu'AIB ait été marquée comme source gratuite dans `fe_sources`.

**Incohérence** :
- `fe_sources.access_level` = `'free'` (correct)
- `emission_factors_all_search.access_level` = `'paid'` (obsolète)

Cette incohérence causait l'affichage des données AIB comme "premium" nécessitant un floutage.

## ✅ Solution Appliquée

### 1. Rafraîchissement de la Projection

Exécution de la fonction de rafraîchissement pour AIB :

```sql
SELECT refresh_ef_all_for_source('AIB');
```

Cette fonction :
- Supprime tous les enregistrements AIB de `emission_factors_all_search`
- Les réinsère avec les valeurs actuelles depuis `emission_factors`
- Utilise un `LEFT JOIN` avec `fe_sources` et `COALESCE(fs.access_level, 'free')` pour garantir la bonne valeur

### 2. Vérification Post-Fix

```sql
SELECT "Source", access_level, COUNT(*) 
FROM emission_factors_all_search 
WHERE "Source" = 'AIB'
GROUP BY "Source", access_level;

-- Résultat APRÈS FIX:
-- Source: AIB, access_level: 'free', count: 2689 ✅
```

Échantillon vérifié :
```sql
SELECT object_id, "Source", access_level, is_blurred, variant
FROM emission_factors_all_search 
WHERE "Source" = 'AIB' LIMIT 5;

-- Tous les enregistrements:
-- access_level = 'free'
-- is_blurred = false
-- variant = 'full'
```

### 3. Synchronisation Algolia

Déclenchement de la synchronisation vers Algolia :

```sql
SELECT trigger_algolia_sync_for_source('AIB');
```

Cette fonction pousse les changements vers l'index Algolia pour que l'interface utilisateur reflète immédiatement les corrections.

## 📊 Impact

- **Enregistrements corrigés** : 2689
- **Source affectée** : AIB
- **Changement** : `access_level` 'paid' → 'free'
- **Effet utilisateur** : Les données AIB sont maintenant visibles sans floutage pour tous les utilisateurs

## 🔍 Prévention Future

### Recommandations

1. **Monitoring** : Ajouter une alerte pour détecter les incohérences entre `fe_sources.access_level` et `emission_factors_all_search.access_level`

2. **Automatisation** : Le système utilise déjà des triggers pour rafraîchir automatiquement lors de changements dans `fe_sources`, mais AIB avait été marquée gratuite avant la mise en place de ces triggers

3. **Script de Vérification** : 
   ```sql
   -- Détecter les incohérences
   SELECT 
     fs.source_name,
     fs.access_level as source_config,
     efs.access_level as search_table_value,
     COUNT(*) as affected_records
   FROM fe_sources fs
   LEFT JOIN emission_factors_all_search efs ON efs."Source" = fs.source_name
   WHERE fs.access_level != efs.access_level
   GROUP BY fs.source_name, fs.access_level, efs.access_level;
   ```

## 🔧 Outils Utilisés

- **MCP Supabase** : Investigation et diagnostic
  - `mcp_supabase_list_tables`
  - `mcp_supabase_execute_sql`
- **Fonctions Supabase** :
  - `refresh_ef_all_for_source('AIB')`
  - `trigger_algolia_sync_for_source('AIB')`

## ✅ Validation

- [x] Données Supabase corrigées
- [x] Synchronisation Algolia déclenchée
- [x] Vérification : tous les enregistrements AIB ont `access_level='free'`
- [x] Documentation créée

---

**Note** : Ce correctif a été appliqué directement en production via MCP Supabase. Aucune migration n'était nécessaire car il s'agissait d'un problème de données obsolètes, pas de structure ou de logique.

