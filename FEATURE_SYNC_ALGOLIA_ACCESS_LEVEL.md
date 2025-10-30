# FEATURE - Synchronisation Automatique Algolia et Filtrage Sources Admin

**Date** : 30 octobre 2025  
**Statut** : ✅ Implémenté  
**Type** : Amélioration / Nettoyage code legacy

## 🎯 Objectifs

### Amélioration 1 : Synchronisation automatique Algolia
Déclencher automatiquement la Task Algolia `22394099-b71a-48ef-9453-e790b3159ade` lors du changement d'`access_level` d'une source (free ↔ paid) depuis la page `/admin`.

### Amélioration 2 : Filtrage des sources
N'afficher dans la page `/admin` que les sources ayant des enregistrements dans `emission_factors_all_search`, évitant ainsi les sources "fantômes" sans données.

## 🔍 Problèmes Identifiés

### Problème 1 : Synchronisation Algolia manquante

**Contexte** : Le commentaire dans `EmissionFactorAccessManager.tsx` ligne 67 indiquait :
```typescript
// Laisser la Edge Function/cron gérer la synchro (suppression de l'appel direct)
```

**Réalité** : Cette Edge Function/cron **n'existe plus**, laissant un vide dans la chaîne de synchronisation.

**Impact** :
- Lors du changement d'`access_level` depuis `/admin`, la table `emission_factors_all_search` était mise à jour via le trigger `trg_fe_sources_refresh_projection`
- **MAIS** Algolia n'était jamais synchronisé
- Les utilisateurs voyaient des données obsolètes dans l'interface de recherche

### Problème 2 : Sources fantômes dans l'admin

**Contexte** : La requête dans `FeSourcesContext.tsx` récupérait toutes les sources avec `is_global = true` :
```typescript
.from('fe_sources')
.select('source_name, access_level')
.eq('is_global', true)
```

**Impact** :
- Affichage de sources n'ayant plus aucun enregistrement dans `emission_factors_all_search`
- Interface admin polluée par des sources obsolètes
- Confusion pour l'administrateur

## ✅ Solutions Implémentées

### Solution 1 : Trigger Database pour Algolia

**Migration** : `supabase/migrations/20251030_trigger_algolia_on_access_level_change.sql`

Création d'un trigger qui :
1. Détecte le changement d'`access_level` sur `fe_sources`
2. Appelle automatiquement `run_algolia_data_task()` avec la Task ID `22394099-b71a-48ef-9453-e790b3159ade`
3. Gère les erreurs sans bloquer la transaction principale

**Ordre d'exécution des triggers sur `fe_sources.access_level`** :
1. `trg_cleanup_free_source_assignments` - Nettoie les assignations si passage à free
2. `trg_fe_sources_refresh_projection` - Met à jour `emission_factors_all_search`
3. `trg_algolia_on_access_level_change` - **NOUVEAU** - Synchronise vers Algolia

**Code trigger** :
```sql
CREATE OR REPLACE FUNCTION public.trigger_algolia_on_access_level_change()
RETURNS TRIGGER AS $$
DECLARE
  v_task_id uuid := '22394099-b71a-48ef-9453-e790b3159ade';
BEGIN
  IF OLD.access_level IS DISTINCT FROM NEW.access_level THEN
    RAISE NOTICE 'Access level changed for source %: % → %', 
      NEW.source_name, OLD.access_level, NEW.access_level;
    
    BEGIN
      PERFORM public.run_algolia_data_task(v_task_id, 'eu');
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Failed to trigger Algolia task: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;
```

### Solution 2 : Vue avec comptage d'enregistrements

**Migration** : `supabase/migrations/20251030_add_source_record_counts.sql`

Création d'une vue `fe_sources_with_counts` qui :
- Joint `fe_sources` avec `emission_factors_all_search`
- Compte le nombre d'enregistrements par source
- Filtre automatiquement les sources globales (`is_global = true`)

**Code vue** :
```sql
CREATE OR REPLACE VIEW public.fe_sources_with_counts AS
SELECT 
  fs.source_name,
  fs.access_level,
  fs.is_global,
  COUNT(DISTINCT efs.object_id) as record_count
FROM public.fe_sources fs
LEFT JOIN public.emission_factors_all_search efs 
  ON efs."Source" = fs.source_name
WHERE fs.is_global = true
GROUP BY fs.source_name, fs.access_level, fs.is_global;
```

**Fichier** : `src/contexts/FeSourcesContext.tsx`

Modification de la requête pour utiliser la nouvelle vue avec filtre :
```typescript
const { data, error } = await supabase
  .from('fe_sources_with_counts')
  .select('source_name, access_level, record_count')
  .gt('record_count', 0)  // Filtrer les sources sans enregistrements
  .order('source_name')
```

**Fichier** : `src/types/source.ts`

Ajout du champ `record_count` à l'interface :
```typescript
export interface FeSource {
  // ... champs existants
  record_count?: number; // Optionnel pour compatibilité
}
```

### Solution 3 : Nettoyage du code legacy

**Fichier** : `src/components/admin/EmissionFactorAccessManager.tsx`

Remplacement du commentaire obsolète (ligne 67) :
```typescript
// AVANT
// Laisser la Edge Function/cron gérer la synchro (suppression de l'appel direct)

// APRÈS
// Note: Algolia sync triggered automatically by database trigger
// trg_algolia_on_access_level_change (migration 20251030)
```

## 📊 Impact

### Avant
- ❌ Changement d'`access_level` ne synchronise pas Algolia
- ❌ Sources fantômes affichées dans `/admin`
- ❌ Code legacy avec commentaires obsolètes

### Après
- ✅ Synchronisation Algolia automatique via trigger database
- ✅ Seulement les sources avec données affichées dans `/admin`
- ✅ Code propre avec commentaires à jour
- ✅ Aucune erreur de linting

## 🔧 Fichiers Modifiés

### Migrations Supabase (nouvelles)
1. `supabase/migrations/20251030_trigger_algolia_on_access_level_change.sql`
2. `supabase/migrations/20251030_add_source_record_counts.sql`

### Code Frontend (modifiés)
3. `src/components/admin/EmissionFactorAccessManager.tsx` - Commentaire mis à jour
4. `src/contexts/FeSourcesContext.tsx` - Utilise `fe_sources_with_counts` avec filtre
5. `src/types/source.ts` - Ajout de `record_count?: number`

## 🧪 Tests à Effectuer

### Test 1 : Synchronisation Algolia
1. Se connecter en tant que supra_admin
2. Aller sur `/admin` → onglet "Accès aux sources"
3. Changer une source de `free` à `paid` (ou inversement)
4. Vérifier dans les **logs Supabase** : `RAISE NOTICE` doit apparaître
5. Vérifier dans **Algolia Dashboard** :
   - Task `22394099-b71a-48ef-9453-e790b3159ade` doit avoir un nouveau run
   - Le statut doit être "success"
6. Vérifier dans l'**interface de recherche** que les données reflètent le nouvel `access_level`

### Test 2 : Filtrage des sources
1. Aller sur `/admin` → onglet "Accès aux sources"
2. **Vérifier** : Seules les sources avec `record_count > 0` sont affichées
3. **Vérifier** : Aucune source "fantôme" (sans données) n'apparaît
4. Comparer avec une requête SQL directe :
   ```sql
   SELECT source_name, record_count 
   FROM fe_sources_with_counts 
   ORDER BY source_name;
   ```

## 📝 Notes Techniques

### Task IDs Algolia du Projet

Le projet utilise 3 Task IDs Algolia différentes :

1. **`914124fb-141d-4239-aeea-784bc5b24f41`** (Import admin complet)
   - Utilisée par : `run_import_from_staging()`, imports admin
   - Synchronise : Toute la table `emission_factors_all_search`

2. **`f3cd3fd0-2db4-49fa-be67-6bd88cbc5950`** (Assignations workspace)
   - Utilisée par : `schedule-source-reindex` Edge Function
   - Synchronise : Lors d'assignation/désassignation de sources premium

3. **`22394099-b71a-48ef-9453-e790b3159ade`** (Changement access_level) - **NOUVEAU**
   - Utilisée par : Trigger `trg_algolia_on_access_level_change`
   - Synchronise : Lors du changement d'`access_level` d'une source

### Ordre des Triggers sur `fe_sources`

Tous les triggers `AFTER UPDATE OF access_level` s'exécutent dans l'ordre de création :

```sql
-- 1. Nettoyage des assignations (si passage à free)
trg_cleanup_free_source_assignments

-- 2. Rafraîchissement de la projection Supabase
trg_fe_sources_refresh_projection

-- 3. Synchronisation Algolia (NOUVEAU)
trg_algolia_on_access_level_change
```

### Gestion des Erreurs

Le trigger `trg_algolia_on_access_level_change` :
- ✅ N'échoue **jamais** la transaction principale
- ✅ Log les erreurs avec `RAISE WARNING`
- ✅ Permet la mise à jour de `fe_sources` même si Algolia est indisponible
- ✅ Garantit la cohérence des données Supabase

## 🔗 Liens Connexes

- **Architecture** : `docs/architecture/source-assignment-flow.md`
- **Hotfix similaire** : `docs/history/2025-10-30_HOTFIX_AIB_source_floutee.md`
- **Script de vérification** : `scripts/check-source-consistency.sql`

---

**Implémenté par** : Assistant AI  
**Date de création** : 30 octobre 2025  
**Prêt pour test** : ✅ Oui

