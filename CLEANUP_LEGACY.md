# Plan de nettoyage du code legacy - Assignation sources premium

## 🎯 Objectif
Supprimer l'ancien flux d'assignation et conserver uniquement le nouveau système basé sur Task Algolia.

## ✅ Déjà fait
- ✅ Migration ID_FE aligné avec l'ID Dataiku
- ✅ Table `algolia_source_assignments_projection` créée
- ✅ Edge Function `schedule-source-reindex` déployée
- ✅ Front mis à jour (`assignFeSourceToWorkspace` / `unassignFeSourceFromWorkspace`)

## ⚠️ À faire

### 1. Migrer `manage-fe-source-assignments-bulk`

**Fichier concerné :** `src/lib/adminApi.ts` ligne 110-116

```typescript
export async function syncWorkspaceAssignments(workspaceId: string, assigned: string[], unassigned: string[]) {
  const { data, error } = await invokeWithAuth('manage-fe-source-assignments-bulk', {
    body: { workspace_id: workspaceId, assigned, unassigned }
  })
  if (error) throw error
  return data
}
```

**Solution proposée :**
- Adapter `schedule-source-reindex` pour accepter un paramètre `bulk: true` avec des listes `assigned[]` / `unassigned[]`
- OU : Boucler côté front sur les sources et appeler `schedule-source-reindex` pour chacune
- Mettre à jour `adminApi.syncWorkspaceAssignments`

### 2. Supprimer les Edge Functions obsolètes

```bash
# Une fois que plus rien ne les appelle
supabase functions delete manage-fe-source-assignments --project-ref wrodvaatdujbpfpvrzge
supabase functions delete manage-fe-source-assignments-bulk --project-ref wrodvaatdujbpfpvrzge

# Supprimer les fichiers locaux
rm -rf supabase/functions/manage-fe-source-assignments
rm -rf supabase/functions/manage-fe-source-assignments-bulk
```

### 3. Nettoyer la documentation obsolète

**À supprimer :**
- `docs/troubleshooting/cbam-records-loss-fix.md`
- `docs/troubleshooting/cbam-records-loss-fix-v2.md`
- `scripts/force-algolia-sync-cbam.sql`
- `scripts/clean-and-resync-cbam.js`
- `scripts/resync-cbam.mjs`

**À conserver (référence historique) :**
- `docs/troubleshooting/cbam-records-loss-FINAL-SOLUTION.md`

### 4. Tests de validation

Avant de supprimer définitivement :

1. **Test assignation simple** : Assigner/désassigner CBAM → vérifier le count dans Algolia
2. **Test bulk** : Assigner 3 sources d'un coup à un workspace → vérifier
3. **Test import admin** : Réimporter CBAM → vérifier que les assignations restent
4. **Test import user** : Importer des facteurs perso → réimporter CBAM admin → vérifier que les facteurs perso sont toujours là

## 📋 Checklist finale

- [ ] Migrer `syncWorkspaceAssignments` vers le nouveau flux
- [ ] Vérifier qu'aucun autre code n'appelle `manage-fe-source-assignments`
- [ ] Supprimer les 2 Edge Functions obsolètes
- [ ] Supprimer les fichiers legacy
- [ ] Nettoyer la documentation
- [ ] Valider les 4 tests ci-dessus
- [ ] Commit : "chore: remove legacy source assignment flow"

