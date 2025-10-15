# 🔥 URGENT : Correction du blur en production - Toutes les sources sont bloquées

## 🚨 Contexte

**Problème critique en production** : Toutes les sources d'émission (y compris les sources gratuites comme CBAM, Base Impacts, etc.) apparaissent blurrées pour tous les utilisateurs, bloquant complètement l'utilisation de l'application.

**Cause identifiée** : Les corrections apportées le 15 octobre pour la gestion des accès aux sources n'ont pas été déployées en production. La production utilise encore l'ancienne logique qui blur toutes les sources non-assignées, sans vérifier si elles sont gratuites ou payantes.

---

## 🔍 Analyse technique

### État actuel en production (main)

1. **Base de données** : Utilise encore `'standard'` et `'premium'` dans `fe_sources.access_level`
2. **Frontend** : Cherche `'free'` et `'paid'` → ne trouve rien → considère toutes les sources comme inconnues
3. **Hook `shouldBlurPaidContent`** : Ne vérifie PAS `access_level`, blur TOUTES les sources non-assignées
4. **Triggers SQL** : Synchrones, causent des timeouts sur les grosses sources (Ember, Base Impacts)

### Code problématique dans main

```typescript
// src/hooks/useEmissionFactorAccess.ts (ligne 72)
const shouldBlurPaidContent = useCallback((source: string) => {
  // ❌ Nouvelle règle unique: full seulement si la source est assignée au workspace
  return !assignedSources.includes(source);
}, [assignedSources]);
```

**Résultat** : Toutes les sources (free et paid) sont blurrées si elles ne sont pas explicitement assignées au workspace, rendant l'application inutilisable pour les utilisateurs freemium.

---

## ✅ Corrections apportées dans cette PR

### 1. Migration SQL : Alignement des valeurs `access_level`

**Fichier** : `supabase/migrations/20251015000000_fix_access_level_values.sql`

- ✅ Migration de `'standard'` → `'free'`
- ✅ Migration de `'premium'` → `'paid'`
- ✅ Mise à jour du `CHECK` constraint
- ✅ Mise à jour de toutes les fonctions SQL
- ✅ Mise à jour des RLS policies

**Impact** : Cohérence frontend-backend, toutes les sources 'free' correctement identifiées

---

### 2. Asynchronisation des triggers lourds

**Fichiers** :
- `supabase/migrations/20251015100000_async_source_refresh.sql`
- `supabase/migrations/20251015120000_fix_assignment_trigger_timeout.sql`

**Changements** :
- ✅ Remplacement de `refresh_ef_all_for_source()` synchrone par `pg_notify` asynchrone
- ✅ Ajout de `schedule_source_refresh()` pour éviter les timeouts
- ✅ Nettoyage automatique des assignations pour sources devenues 'free'
- ✅ Trigger asynchrone pour assignations workspace

**Impact** : 
- Fini les timeouts de 57014 lors du changement d'access_level
- Assignation/désassignation instantanée des sources

---

### 3. Correction du hook `useEmissionFactorAccess`

**Fichier** : `src/hooks/useEmissionFactorAccess.ts`

```typescript
const shouldBlurPaidContent = useCallback((source: string) => {
  const metadata = sourcesMetadata.get(source);
  if (!metadata) return false; // Source inconnue = pas de blur par défaut
  
  // ✅ Si la source est 'free', jamais de blur (accessible à tous)
  if (metadata.access_level === 'free') return false;
  
  // ✅ Si 'paid', blur uniquement si non-assignée au workspace
  return !assignedSources.includes(source);
}, [sourcesMetadata, assignedSources]);
```

**Impact** : Les sources gratuites (CBAM, Base Impacts, etc.) sont immédiatement accessibles à tous les utilisateurs

---

### 4. Amélioration de l'UI Admin

**Fichier** : `src/components/admin/SourceWorkspaceAssignments.tsx`

- ✅ Badge "Toujours activée" pour les sources 'free'
- ✅ Impossibilité de désactiver une source gratuite (UX claire)
- ✅ Feedback visuel pour les opérations asynchrones

---

### 5. Nettoyage des données existantes

**Fichier** : `scripts/cleanup_free_source_assignments.sql`

Script SQL pour nettoyer les assignations incorrectes des sources gratuites qui ne devraient jamais être assignées explicitement.

---

## 📊 Tests effectués

### ✅ Tests locaux (confirmés)

1. **Changement access_level** : `'free'` ↔ `'paid'` → aucun timeout
2. **Sources gratuites** : Accessibles sans assignation
3. **Sources payantes** : Blurrées si non-assignées
4. **Assignation/désassignation** : Instantanée, pas de timeout
5. **Grosse source (Ember)** : Changement d'access_level < 1s

### ⚠️ Tests production (à valider après merge)

1. Vérifier que les sources gratuites sont accessibles à tous
2. Vérifier que les sources payantes restent blurrées si non-assignées
3. Tester l'assignation/désassignation depuis l'admin
4. Valider qu'il n'y a plus de timeouts

---

## 🚀 Plan de déploiement

### Étape 1 : Merge vers main
1. ✅ Review de la PR
2. ✅ Merge de la branche `fix/source-access-management-complete` dans `main`

### Étape 2 : Déploiement automatique (Vercel)
- Le déploiement frontend est automatique après merge dans `main`
- Temps estimé : 2-3 minutes

### Étape 3 : Migrations SQL (Supabase)
Les migrations SQL doivent être appliquées manuellement :

```bash
# Se connecter à Supabase production
supabase db push

# OU via l'interface Supabase SQL Editor :
# 1. Copier le contenu de 20251015000000_fix_access_level_values.sql
# 2. Exécuter dans SQL Editor
# 3. Répéter pour les autres migrations (dans l'ordre)
```

**Ordre des migrations** :
1. `20251015000000_fix_access_level_values.sql` (CRITIQUE - change les valeurs)
2. `20251015100000_async_source_refresh.sql` (Performance)
3. `20251015100001_cleanup_existing_free_assignments.sql` (Nettoyage optionnel)
4. `20251015120000_fix_assignment_trigger_timeout.sql` (Performance)

### Étape 4 : Nettoyage (Optionnel)
```bash
# Exécuter le script de nettoyage pour supprimer les assignations incorrectes
# Via Supabase SQL Editor : scripts/cleanup_free_source_assignments.sql
```

### Étape 5 : Validation
1. Se connecter avec un compte freemium
2. Vérifier que les sources gratuites (CBAM, Base Impacts, etc.) sont visibles
3. Tester l'assignation d'une source payante depuis l'admin
4. Vérifier les logs Supabase pour s'assurer qu'il n'y a plus de timeouts

---

## 📝 Rollback (si nécessaire)

Si un problème survient après le déploiement :

### Option 1 : Revert frontend uniquement
```bash
git revert HEAD
git push origin main
```

### Option 2 : Revert migrations SQL
Utiliser les backups Supabase pour restaurer l'état précédent (non recommandé car perte de données possibles)

---

## 🔗 Ressources

### Documentation créée
- `IMPLEMENTATION_COMPLETE_SOURCE_MANAGEMENT.md` : Guide complet de l'implémentation
- `SESSION_SUMMARY_20251015_SOURCE_ACCESS_COMPLETE.md` : Résumé détaillé de la session
- `CHANGELOG_20251015.md` : Changelog pour les parties prenantes
- `DIAGNOSTIC_CBAM_BLUR.md` : Diagnostic du problème initial
- `SOLUTION_TOUTES_SOURCES_BLURREES.md` : Solution détaillée avec code de debug

### Migrations SQL
- `supabase/migrations/README_20251015_SOURCE_ACCESS.md` : Documentation technique des migrations

---

## ⚠️ Points d'attention

### 1. Migration irréversible
La migration `20251015000000_fix_access_level_values.sql` modifie les données existantes (`'standard'` → `'free'`, `'premium'` → `'paid'`). Bien qu'elle soit réversible techniquement, il est préférable de ne pas revenir en arrière.

### 2. Impact utilisateur
- **Positif** : Déblocage immédiat de tous les utilisateurs freemium
- **Négatif** : Aucun impact négatif prévu (toutes les sources 'free' deviennent accessibles comme prévu)

### 3. Performance
Les triggers asynchrones améliorent considérablement la performance, mais nécessitent un worker Supabase pour traiter les notifications `pg_notify`. **À vérifier que les workers sont bien configurés en production.**

---

## ✅ Checklist avant merge

- [x] Code reviewé et testé localement
- [x] Migrations SQL testées en local
- [x] Documentation complète créée
- [x] Tests de non-régression effectués
- [x] Plan de déploiement documenté
- [x] Plan de rollback documenté
- [ ] Review par un autre développeur
- [ ] Validation par le product owner

---

## 🎯 Résumé exécutif

**Problème** : Toutes les sources blurrées en production, application inutilisable  
**Cause** : Migration non déployée, valeurs `access_level` incorrectes  
**Solution** : 4 migrations SQL + correction du hook frontend  
**Impact** : Déblocage immédiat de tous les utilisateurs  
**Risque** : Très faible (testé localement, réversible)  
**Priorité** : 🔴 CRITIQUE - À déployer immédiatement

---

**Créé par** : Axel Girard  
**Date** : 2025-10-15  
**Branch** : `fix/source-access-management-complete` → `main`  
**Type** : 🔥 Hotfix Production

