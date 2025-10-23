# HOTFIX - Correction records Algolia dépassant 10KB

**Date** : 2025-10-23  
**Type** : Hotfix  
**Impact** : Correction de 316 records BEIS dépassant la limite Algolia

## 🐛 Problème identifié

Algolia impose une limite de **10KB par record**. 316 facteurs d'émission de la source **BEIS** dépassaient cette limite en raison de commentaires très longs (~5 000 caractères).

### Record exemple
- **Object ID** : `922ecc39-d916-4974-80e2-fe8871d059a0`
- **Nom** : "Cargo - Marchandises générales - 5 000 à 9 999 tpl"
- **Source** : BEIS
- **Taille avant** : 10.45 KB
- **Problème** : Commentaires_fr (5 015 chars) + Commentaires_en (4 260 chars)

### Statistiques avant correction
- **316 records** > 10KB (tous de source BEIS)
- Taille max : **10.59 KB**
- Moyenne commentaires : ~5 000 caractères (FR), ~4 300 (EN)

## ✅ Solution appliquée

1. **Sauvegarde** : Création de `backup_oversized_comments` avec les 316 records
2. **Suppression** : Mise à NULL de `Commentaires` et `Commentaires_en` pour les records BEIS avec commentaires > 4000 caractères
3. **Propagation** : Les triggers ont automatiquement mis à jour `emission_factors_all_search`

### Commandes SQL exécutées

```sql
-- 1. Sauvegarde
CREATE TABLE backup_oversized_comments AS
SELECT 
  object_id,
  "Source",
  "Nom_fr",
  "Commentaires_fr",
  "Commentaires_en",
  pg_column_size(row(emission_factors_all_search.*)) as original_size_bytes,
  now() as backup_timestamp
FROM emission_factors_all_search
WHERE pg_column_size(row(emission_factors_all_search.*)) > 10240;

-- 2. Suppression des commentaires
UPDATE emission_factors
SET 
  "Commentaires" = NULL,
  "Commentaires_en" = NULL,
  updated_at = now()
WHERE "Source" = 'BEIS'
  AND (length(COALESCE("Commentaires", '')) > 4000 
       OR length(COALESCE("Commentaires_en", '')) > 4000);
```

## 📊 Résultats après correction

| Métrique | Avant | Après |
|----------|-------|-------|
| Records > 10KB | 316 | **0** ✅ |
| Taille max | 10.59 KB | **7.95 KB** ✅ |
| Taille moyenne (records corrigés) | 10.46 KB | **1.19 KB** ✅ |
| Records affectés | 317 (dans `emission_factors`) | - |

### Vérification du record exemple
- **Object ID** : `922ecc39-d916-4974-80e2-fe8871d059a0`
- **Taille après** : **1.18 KB** (vs 10.45 KB avant)
- **Commentaires** : NULL (sauvegardés dans `backup_oversized_comments`)

## 🔍 Requête de vérification

```sql
-- Vérifier qu'aucun record ne dépasse 10KB
SELECT 
  COUNT(*) FILTER (WHERE pg_column_size(row(emission_factors_all_search.*)) > 10240) as oversized,
  COUNT(*) as total,
  round(MAX(pg_column_size(row(emission_factors_all_search.*)))::numeric / 1024, 2) as max_kb
FROM emission_factors_all_search;
```

**Résultat attendu** : `oversized = 0`, `max_kb < 10.00`

## 💾 Récupération des commentaires

Les commentaires supprimés sont disponibles dans la table de backup :

```sql
SELECT * FROM backup_oversized_comments WHERE object_id = '<object_id>';
```

## 📝 Notes

- **Source affectée** : Uniquement BEIS (100% des records problématiques)
- **Champs supprimés** : `Commentaires` et `Commentaires_en`
- **Autres champs** : Tous les autres champs (Description, Nom, FE, etc.) sont intacts
- **Backup** : Les commentaires originaux sont sauvegardés dans `backup_oversized_comments`

## 🎯 Actions de suivi

- [ ] Considérer une limitation automatique des commentaires à l'import depuis Dataiku
- [ ] Documenter la limite de 10KB pour les futurs imports
- [ ] Évaluer si d'autres sources pourraient avoir ce problème à l'avenir

---

**Status** : ✅ Résolu  
**Testé** : Oui - 625 449 records vérifiés, 0 dépassent 10KB

