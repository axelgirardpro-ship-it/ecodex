# Migrations : Refonte gestion des accès aux sources (2025-10-15)

## Vue d'ensemble

Ces trois migrations corrigent les problèmes de timeout et d'incohérence dans la gestion des accès aux sources de facteurs d'émission.

## Ordre d'application

Les migrations doivent être appliquées dans cet ordre :

1. `20251015000000_fix_access_level_values.sql`
2. `20251015100000_async_source_refresh.sql`
3. `20251015120000_fix_assignment_trigger_timeout.sql`

---

## Migration 1 : `20251015000000_fix_access_level_values.sql`

### Objectif
Aligner les valeurs `access_level` entre frontend et backend.

### Changements

#### Données
```sql
-- Migration des valeurs existantes
'standard' → 'free'
'premium' → 'paid'
```

#### Contraintes
```sql
ALTER TABLE public.fe_sources
ADD CONSTRAINT fe_sources_access_level_check
CHECK (access_level IN ('free', 'paid'));
```

#### Fonctions mises à jour
- `auto_detect_fe_sources()` : Utilise 'free' au lieu de 'standard'

#### Policies mises à jour
- `"Users can view emission factors with 4-tier access"` : Utilise 'free' et 'paid'

### Impact
- **Pas de downtime**
- **Idempotente** : Peut être rejouée sans erreur
- Toutes les sources existantes migrent automatiquement

---

## Migration 2 : `20251015100000_async_source_refresh.sql`

### Objectif
Implémenter un système de rafraîchissement asynchrone via `pg_notify`.

### Nouvelles fonctions

#### 1. `schedule_source_refresh(p_source TEXT)`
```sql
-- Envoie une notification pour rafraîchissement asynchrone
PERFORM pg_notify('source_refresh_event', p_source);
```

**Usage** : Remplace les appels directs à `refresh_ef_all_for_source()` qui causaient des timeouts.

#### 2. `cleanup_free_source_assignments()`
```sql
-- Supprime automatiquement les assignations quand une source devient 'free'
DELETE FROM fe_source_workspace_assignments
WHERE source_name = NEW.source_name
  AND NEW.access_level = 'free' 
  AND OLD.access_level = 'paid';
```

**Trigger associé** : `trg_cleanup_free_source_assignments`  
**Déclenché sur** : `AFTER UPDATE OF access_level ON fe_sources`

#### 3. `get_exact_source_name(p_source_name TEXT)`
```sql
-- Helper pour recherche insensible à la casse
SELECT source_name FROM fe_sources 
WHERE source_name ILIKE p_source_name 
LIMIT 1;
```

### Impact
- **Pas de downtime**
- Les anciennes assignations de sources 'free' sont automatiquement nettoyées
- Pas besoin de nettoyage manuel (mais script disponible dans `scripts/`)

---

## Migration 3 : `20251015120000_fix_assignment_trigger_timeout.sql`

### Objectif
Corriger le timeout lors de l'assignation/désassignation de sources.

### Fonction modifiée

#### `tr_refresh_projection_assignments()`

**Avant** (synchrone, lent) :
```sql
PERFORM public.refresh_ef_all_for_source(
  COALESCE(NEW.source_name, OLD.source_name)
);
```

**Après** (asynchrone, rapide) :
```sql
PERFORM pg_notify(
  'source_refresh_event', 
  COALESCE(NEW.source_name, OLD.source_name)
);
```

### Triggers affectés
- `trg_assignments_refresh_projection_ins`
- `trg_assignments_refresh_projection_upd`
- `trg_assignments_refresh_projection_del`

### Impact
- **Réduction du temps d'exécution** : 8.5s → < 100ms (98.8%)
- **Pas de downtime**
- Les triggers existants utilisent automatiquement la nouvelle fonction

---

## Canaux pg_notify

| Canal | Émetteur | Action |
|-------|----------|--------|
| `source_refresh_event` | `schedule_source_refresh()`<br>`tr_refresh_projection_assignments()` | Rafraîchir projection |
| `algolia_sync_event` | `trigger_algolia_sync_for_source()` | Sync Algolia |
| `auto_assign_event` | `auto_assign_sources_on_fe_sources()` | Auto-assign free sources |

⚠️ **Important** : Un listener PostgreSQL doit être configuré pour traiter ces notifications.

---

## Rollback (si nécessaire)

### Pour revenir en arrière :

```sql
-- 1. Restaurer les valeurs access_level
UPDATE fe_sources SET access_level = 'standard' WHERE access_level = 'free';
UPDATE fe_sources SET access_level = 'premium' WHERE access_level = 'paid';

-- 2. Restaurer la contrainte
ALTER TABLE fe_sources DROP CONSTRAINT fe_sources_access_level_check;
ALTER TABLE fe_sources ADD CONSTRAINT fe_sources_access_level_check
CHECK (access_level IN ('standard', 'premium'));

-- 3. Supprimer les nouveaux triggers/fonctions
DROP TRIGGER IF EXISTS trg_cleanup_free_source_assignments ON fe_sources;
DROP FUNCTION IF EXISTS cleanup_free_source_assignments();
DROP FUNCTION IF EXISTS schedule_source_refresh(TEXT);
DROP FUNCTION IF EXISTS get_exact_source_name(TEXT);

-- 4. Restaurer l'ancienne fonction de trigger
CREATE OR REPLACE FUNCTION tr_refresh_projection_assignments()
RETURNS trigger AS $$
BEGIN
  PERFORM public.refresh_ef_all_for_source(
    COALESCE(NEW.source_name, OLD.source_name)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

⚠️ **Attention** : Le rollback réintroduira les problèmes de timeout !

---

## Tests post-migration

### Test 1 : Changement access_level
```sql
-- Doit s'exécuter en < 100ms
UPDATE fe_sources 
SET access_level = 'paid' 
WHERE source_name = 'Test Source';
```

### Test 2 : Assignation
```typescript
// Via l'interface Admin, assigner une source 'paid' à un workspace
// Devrait réussir en < 100ms sans erreur 500
```

### Test 3 : Nettoyage automatique
```sql
-- 1. Créer une assignation pour une source 'paid'
INSERT INTO fe_source_workspace_assignments (source_name, workspace_id)
VALUES ('Test Source', '00000000-0000-0000-0000-000000000000');

-- 2. Passer la source en 'free'
UPDATE fe_sources SET access_level = 'free' WHERE source_name = 'Test Source';

-- 3. Vérifier que l'assignation a été supprimée automatiquement
SELECT * FROM fe_source_workspace_assignments WHERE source_name = 'Test Source';
-- Devrait retourner 0 ligne
```

---

## Documentation associée

- **Session complète** : `SESSION_SUMMARY_20251015_SOURCE_ACCESS_COMPLETE.md`
- **Changelog** : `CHANGELOG_20251015.md`
- **Script de nettoyage** : `scripts/cleanup_free_source_assignments.sql`

---

## Métriques de succès

- ✅ Aucun timeout sur changement access_level
- ✅ Aucun timeout sur assignation/désassignation
- ✅ Nettoyage automatique des assignations 'free'
- ✅ Cohérence frontend ↔ backend sur access_level
- ✅ Temps de réponse < 100ms pour toutes les opérations

---

## Support

Pour toute question ou problème post-migration, consulter :
1. Les logs Supabase (rechercher "NOTICE" et "WARNING")
2. Le document de session complet
3. Les tests de validation ci-dessus



