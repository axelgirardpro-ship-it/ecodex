# Release Notes : Correction Assignation de Sources

**Date** : 13 octobre 2025  
**Version** : Edge Function `schedule-source-reindex` v10  
**Type** : Bugfix + Performance Optimization  
**Statut** : ✅ Déployé et Testé

---

## 🎯 Problème résolu

### Erreur 500 sur l'assignation de sources avec casse différente

L'Edge Function `schedule-source-reindex` retournait une erreur 500 lors de l'assignation de certaines sources (notamment "Inies") depuis la page Admin, alors que d'autres sources (comme "ElectricityMaps") fonctionnaient correctement.

**Cause racine** : Incohérence de casse entre le nom envoyé par l'interface (`"Inies"`) et le nom stocké en base (`"INIES"`), combinée à une comparaison stricte qui échouait.

---

## ✨ Améliorations apportées

### 1. **Recherche insensible à la casse** 
- Nouvelle fonction SQL `get_exact_source_name()` pour validation robuste
- Récupération du nom exact de la source avant toutes opérations
- Compatible avec toutes les variations de casse : "INIES", "Inies", "inies", etc.

### 2. **Performance optimisée**
- Traitement des données Algolia directement en SQL (fonction `trigger_algolia_sync_for_source()`)
- Aucun timeout même avec 20k+ enregistrements
- Temps d'exécution : 13-15s pour les grosses sources (stable)

### 3. **Fiabilité améliorée**
- Appel direct à l'API Algolia depuis l'Edge Function (plus fiable que `net.http_post()`)
- Logs structurés avec émojis pour meilleure traçabilité
- Gestion d'erreurs robuste à chaque étape

### 4. **Architecture hybride optimale**
- SQL pour la préparation des données (rapide)
- Edge Function pour l'API Algolia (fiable)
- Meilleure séparation des responsabilités

---

## 📋 Migrations SQL appliquées

1. `20251013092041_create_get_exact_source_name_function.sql`
   - Fonction de validation insensible à la casse
   
2. `20251013092619_create_async_algolia_sync_function.sql`
   - Fonction de préparation des données Algolia
   
3. `20251013093050_update_algolia_sync_function_use_edge_function.sql`
   - Mise à jour pour compatibilité avec Edge Function
   
4. `20251013093122_simplify_algolia_sync_function.sql`
   - Version finale simplifiée et optimisée

---

## 🧪 Tests effectués

- ✅ Assignation de "INIES" (20 741 enregistrements) : Succès
- ✅ Assignation de "ElectricityMaps" (3 000+ enregistrements) : Succès
- ✅ Désassignation de sources : Succès
- ✅ Vérification du déclenchement de la tâche Algolia : Succès
- ✅ Logs Edge Function : Traçabilité complète

---

## 📊 Impact

| Aspect | Avant | Après |
|--------|-------|-------|
| **Erreurs 500** | Intermittentes sur INIES | ✅ Aucune |
| **Compatibilité casse** | ❌ Sensible | ✅ Insensible |
| **Temps d'exécution** | 8s+ (timeout) | 13-15s (stable) |
| **Robustesse** | ⚠️ Fragile | ✅ Robuste |
| **Traçabilité** | Logs basiques | ✅ Logs structurés |

---

## 🔧 Fichiers modifiés

### Edge Functions
- `supabase/functions/schedule-source-reindex/index.ts` (v10)
- `supabase/functions/schedule-source-reindex/deno.json` (nouveau)
- `supabase/functions/types/esm-sh.d.ts` (amélioré)

### Migrations SQL
- 4 nouvelles migrations (voir section ci-dessus)

### Documentation
- `BUGFIX_SOURCE_ASSIGNMENT_CASE.md` (documentation technique complète)
- `RELEASE_NOTES_SOURCE_ASSIGNMENT_FIX.md` (ce document)

---

## 🚀 Déploiement

```bash
# Edge Function
npx supabase functions deploy schedule-source-reindex --no-verify-jwt

# Migrations SQL (déjà appliquées automatiquement)
```

---

## 📖 Utilisation

1. **Page Admin** → Sélectionner un workspace
2. Choisir une source (casse indifférente)
3. Cliquer sur "Assign" ou "Unassign"
4. ✅ L'opération se termine avec succès
5. La tâche Algolia se déclenche automatiquement

---

## 🔍 Monitoring

Les logs de l'Edge Function incluent maintenant :
- `[START]` : Début de l'opération
- `[VALIDATION]` : Vérification de la source
- `[STEP 1-4]` : Étapes détaillées
- `[SUCCESS]` : Fin réussie
- `✓` : Succès d'une étape
- `✗` : Erreur
- `⚠` : Avertissement

Exemple de logs :
```
[START] Action: assign, Source: Inies, Workspace: xxx-xxx
[VALIDATION] Checking if source exists: Inies
✓ Source found with exact name: INIES
[STEP 1] Updating fe_source_workspace_assignments...
✓ Assignment successful
[STEP 2] Calling refresh_ef_all_for_source for: INIES
✓ refresh_ef_all_for_source completed successfully
[STEP 3] Preparing Algolia data...
✓ Algolia data prepared
[STEP 4] Triggering Algolia task...
✓ Algolia task triggered successfully
[SUCCESS] Operation completed
```

---

## 📚 Références

- Documentation technique : `BUGFIX_SOURCE_ASSIGNMENT_CASE.md`
- Edge Function : `supabase/functions/schedule-source-reindex/index.ts`
- Migrations SQL : `supabase/migrations/20251013*.sql`

---

**Contact** : En cas de problème, vérifier les logs Edge Function dans le Dashboard Supabase

