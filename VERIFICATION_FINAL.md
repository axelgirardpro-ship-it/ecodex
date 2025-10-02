# Vérification finale : Assignation de sources premium via Task Algolia

## ✅ 1. Conservation des assignations workspace lors d'un import admin

**État : PROTÉGÉ**

### Comment ça fonctionne

La fonction `refresh_ef_all_for_source()` (lignes 315-438 de `20251001_refonte_import_admin.sql`) :

```sql
SELECT array_agg(ws.workspace_id)
FROM public.fe_source_workspace_assignments ws
WHERE ws.source_name = ef."Source"
) AS assigned_workspace_ids
```

**Flux :**
1. Import admin → `run_import_from_staging()` → INSERT dans `emission_factors`
2. Pour chaque source importée → `refresh_ef_all_for_source(source_name)`
3. Cette fonction LIT `fe_source_workspace_assignments` et RECONSTRUIT `assigned_workspace_ids`
4. Résultat : **Les assignations manuelles faites via l'admin sont TOUJOURS préservées**

**Garantie :** Tant que `fe_source_workspace_assignments` n'est pas modifiée, les assignations survivent à tous les imports admin.

---

## ✅ 2. Protection des imports utilisateurs

**État : PROTÉGÉ**

### Séparation stricte des scopes

Dans `emission_factors_all_search` :
- **Records globaux (admin)** : `scope='public'`, `workspace_id=NULL`, `ID_FE` basé sur l'ID Dataiku
- **Records utilisateurs** : `scope='private'`, `workspace_id=<uuid>`, proviennent de `user_factor_overlays`

### Comment la fonction `refresh_ef_all_for_source` protège les imports users

Ligne 327 de la migration :
```sql
DELETE FROM public.emission_factors_all_search WHERE "Source" = p_source;
```

Puis lignes 338-389 :
```sql
SELECT ... FROM public.emission_factors ef ... WHERE ef."Source" = p_source;
```

**ET** lignes 391-438 (imports users) :
```sql
SELECT ... FROM public.user_factor_overlays ufo ... WHERE ufo."Source" = p_source;
```

**Résultat :**
- Quand on rafraîchit une source (ex. CBAM), on SUPPRIME tous les records de cette source
- Puis on RÉINSÈRE :
  1. Les facteurs globaux (`emission_factors`)
  2. **ET** les overlays utilisateurs (`user_factor_overlays`)
  
**Garantie :** Les imports users ne sont JAMAIS écrasés, ils sont réinsérés systématiquement avec les données globales.

---

## ✅ 3. Nettoyage du legacy code

### Fonctions obsolètes identifiées

| Élément | Type | Statut | Action |
|---------|------|--------|--------|
| `manage-fe-source-assignments` | Edge Function (v91) | ⚠️ OBSOLÈTE | À supprimer |
| `manage-fe-source-assignments-bulk` | Edge Function (v71) | ⚠️ UTILISÉE | À migrer vers `schedule-source-reindex` |
| `syncAlgoliaForSource` | Code dans Edge Function | ⚠️ OBSOLÈTE | Supprimé par la nouvelle implémentation |

### Fonctions à conserver

| Élément | Raison |
|---------|--------|
| `schedule-source-reindex` | ✅ Nouvelle implémentation (remplace l'ancien flux) |
| `algolia-run-task` | ✅ Helper générique pour déclencher les Tasks Algolia |
| `refresh_ef_all_for_source` | ✅ Fonction SQL core (préserve assignations + overlays) |

### Plan de nettoyage

#### Étape 1 : Migrer `manage-fe-source-assignments-bulk`
Cette fonction est encore utilisée dans `src/lib/adminApi.ts` ligne 111 :
```typescript
export async function syncWorkspaceAssignments(workspaceId: string, assigned: string[], unassigned: string[])
```

**Action :** Adapter `schedule-source-reindex` pour gérer les bulk assignments, puis mettre à jour `adminApi.ts`.

#### Étape 2 : Supprimer `manage-fe-source-assignments`
Une fois que plus rien ne l'appelle, supprimer :
```bash
rm -rf supabase/functions/manage-fe-source-assignments
supabase functions delete manage-fe-source-assignments
```

#### Étape 3 : Nettoyer la documentation
Supprimer ou marquer comme obsolètes :
- `docs/troubleshooting/cbam-records-loss-fix.md`
- `docs/troubleshooting/cbam-records-loss-fix-v2.md`
- `scripts/force-algolia-sync-cbam.sql`

Conserver :
- `docs/troubleshooting/cbam-records-loss-FINAL-SOLUTION.md` (référence historique)

---

## Résumé des garanties

✅ **Import admin** → Les assignations workspace sont lues depuis `fe_source_workspace_assignments` et reconstituées  
✅ **Import admin** → Les imports users (`user_factor_overlays`) sont réinsérés avec les données globales  
✅ **Nouveau flux** → `schedule-source-reindex` + Task Algolia = robuste, paginé, asynchrone  
⚠️ **Legacy** → Il reste à migrer `manage-fe-source-assignments-bulk` et à supprimer l'ancienne Edge Function

---

## Actions recommandées

1. **Migrer la fonction bulk** pour finaliser la transition
2. **Supprimer les Edge Functions obsolètes** une fois la migration terminée
3. **Nettoyer la documentation** pour éviter toute confusion
4. **Tester un import admin** sur une source avec assignations + overlays users pour valider

