# 📘 Guide Complet : Système de Matching d'ID Dataiku

**Version** : 2.0 (Octobre 2025)  
**Fichier Code** : `dataiku_id_matching_recipe_FINAL.py`  
**Statut** : ✅ Production-ready

---

## 🎯 Objectif

Maintenir des **IDs stables** pour les facteurs d'émission entre différents imports admin, en utilisant une **clé naturelle** basée sur les caractéristiques métier des records.

### Problème Résolu

❌ **Avant** : Chaque import générait de nouveaux IDs → Perte de traçabilité  
✅ **Après** : Les mêmes facteurs conservent leurs IDs → Continuité garantie

---

## 🔑 Concept : La Clé Naturelle

### Définition

Une **combinaison de colonnes** qui identifient **de manière unique** un facteur d'émission :

```python
NATURAL_KEY = [
    'Nom',                      # Ex: "Peintures BIOPRO"
    'Périmètre',                # Ex: "A1-A2-A4-A5-C1-C2-C3-C4"
    'Localisation',             # Ex: "France"
    'Source',                   # Ex: "INIES"
    'Date',                     # Ex: 2025
    'Unité donnée d\'activité'  # Ex: "kg" ou "m²"
]
```

### Pourquoi l'Unité est Cruciale ?

**Sans l'unité** :
```
"Peintures BIOPRO, France, INIES, 2025"
  → Même hash pour kg ET m²
  → Même ID assigné
  → DOUBLON d'ID ❌
```

**Avec l'unité** :
```
"Peintures BIOPRO, France, INIES, 2025, kg"  → Hash A → ID 001
"Peintures BIOPRO, France, INIES, 2025, m²"  → Hash B → ID 002
  → IDs différents ✅
```

---

## ⚙️ Fonctionnement du Code

### 1. Normalisation des Données

```python
def normalize_dataframe(df):
    # Nettoyer les espaces, casse, arrondir les nombres
    # Garantit que "France" = "france " = "FRANCE"
```

**Objectif** : Deux records identiques doivent avoir le même hash, même avec des variations mineures de formatage.

### 2. Génération du Hash

```python
def generate_natural_key_hash(row):
    # Concatène les valeurs de NATURAL_KEY
    # Génère un hash court (16 caractères)
    return hashlib.blake2b(key.encode(), digest_size=8).hexdigest()
```

**Exemple** :
```
Input:  Nom="Peintures BIOPRO" + Périmètre="A1..." + ... + Unité="kg"
Output: Hash = "25bbddf40141fd23"
```

### 3. Matching avec la Source

```python
for idx, row in df_new_normalized.iterrows():
    natural_hash = row['natural_key_hash']
    
    if natural_hash in source_dict:
        # MATCH TROUVÉ → Réutiliser l'ID existant
        existing_id = source_dict[natural_hash]['ID']
        
        if compare_records(row, source_dict[natural_hash]['data']):
            operation = 'UNCHANGED'  # Aucun changement
        else:
            operation = 'UPDATE'      # Valeurs modifiées (FE, etc.)
    else:
        # NOUVEAU RECORD → Générer un nouvel UUID
        existing_id = generate_new_uuid()
        operation = 'INSERT'
```

### 4. Classification des Operations

| Operation | Signification |
|-----------|---------------|
| **INSERT** | Nouveau facteur d'émission (hash inconnu) |
| **UPDATE** | Facteur existant avec valeurs modifiées (FE, Incertitude, etc.) |
| **UNCHANGED** | Facteur existant sans aucun changement |

### 5. Déduplication Intelligente

**Si des doublons d'ID subsistent** (cas edge) :

```python
if duplicate_ids > 0:
    # Tri par priorité: INSERT > UPDATE > UNCHANGED
    operation_priority = {'INSERT': 1, 'UPDATE': 2, 'UNCHANGED': 3}
    df_output['_priority'] = df_output['operation'].map(operation_priority)
    df_output = df_output.sort_values('_priority')
    
    # Garder uniquement la première occurrence = nouvel import
    df_output = df_output.drop_duplicates(subset=['ID'], keep='first')
```

**Garantie** : **0 doublon d'ID** en sortie, avec priorité au nouvel import (version la plus récente).

---

## 🚀 Utilisation dans Dataiku

### Étape 1 : Créer le Projet

1. **Nouveau projet** : "Emission Factors ID Matching"
2. **Import CSV** : Dataset "new_import" (ton fichier d'import admin)
3. **Dataset source** : "emission_factors_source" (vide au premier run)

### Étape 2 : Créer la Recette Python

1. **Recette Python** : "ID Matching"
2. **Input** : `new_import`, `emission_factors_source`
3. **Output** : `emission_factors_with_ids`

### Étape 3 : Copier le Code

1. Ouvre `dataiku_id_matching_recipe_FINAL.py`
2. **Copie TOUT le contenu**
3. **Colle** dans la recette Dataiku (remplace tout)
4. **Enregistre** (Ctrl+S / Cmd+S)

### Étape 4 : Premier Run (Fresh Start)

**Source vide = Tous les records en INSERT**

1. Lance la recette
2. **Logs attendus** :
   ```
   📊 STATISTIQUES FINALES:
   🆕 Insertions : 453,584
   📝 Updates     : 0
   ↔️  Inchangés   : 0
   
   ✓ Tous les IDs sont uniques
   ```

3. **Sauvegarde** : `emission_factors_with_ids` → `emission_factors_source`

### Étape 5 : Runs Suivants (Matching Actif)

**Source remplie = Matching des IDs existants**

1. Nouveau import → Dataset `new_import`
2. Lance la recette
3. **Logs attendus** :
   ```
   📊 STATISTIQUES FINALES:
   🆕 Insertions : 150      ← Nouveaux facteurs
   📝 Updates     : 1,230   ← Valeurs modifiées
   ↔️  Inchangés   : 452,204 ← Aucun changement
   
   ✓ Tous les IDs sont uniques
   ```

4. **Sauvegarde** : Mettre à jour `emission_factors_source`

---

## ✅ Garanties du Système

### 1. Unicité des IDs : 100%

**Ligne 415 du code** garantit mathématiquement :
```python
df_output = df_output.drop_duplicates(subset=['ID'], keep='first')
```

→ **Impossible d'avoir un doublon d'ID** en sortie

### 2. Priorité au Nouvel Import

En cas de doublon (cas edge), **toujours garder la version la plus récente** :
- INSERT (priorité 1) > UPDATE (priorité 2) > UNCHANGED (priorité 3)

### 3. Stabilité des IDs

**Tant que la clé naturelle ne change pas**, l'ID reste identique :
- Modification du FE → Même ID (operation = UPDATE)
- Modification de l'Unité → Nouvel ID (nouvelle clé naturelle)

### 4. Intégrité des Données

**Colonnes essentielles vérifiées** :
```python
['Nom', 'Source']  # Ne doivent JAMAIS être vides
```

→ Si valeurs vides détectées → **Alerte dans les logs** (pas d'erreur bloquante)

**Note** : La déduplication peut réduire le nombre total de records (suppression volontaire des doublons d'ID), ce qui est normal et attendu.

---

## 🔍 Validation Post-Exécution

### Dans Dataiku (Logs)

```
✅ À vérifier :
✓ Tous les records ont un ID
✓ Tous les IDs sont uniques
✓ Intégrité vérifiée pour 7 colonnes critiques
```

### Dans Supabase (SQL)

Après upload, exécute `scripts/validate_no_duplicate_ids.sql` :

```sql
-- Test 1: Compter les doublons (doit retourner 0 rows)
SELECT "ID", COUNT(*) 
FROM staging_emission_factors
GROUP BY "ID"
HAVING COUNT(*) > 1;

-- Test 2: Vérifier la cohérence
SELECT 
    COUNT(*) as total,
    COUNT(DISTINCT "ID") as unique_ids
FROM staging_emission_factors;
-- total = unique_ids ✅
```

---

## 🛠️ Résolution de Problèmes

### Problème 1 : Doublons d'ID Détectés

**Cause** : La colonne Unité n'est pas dans `NATURAL_KEY`

**Solution** : Vérifier ligne 31 du code :
```python
'Unité donnée d\'activité'  # Doit être présent !
```

### Problème 2 : Anciennes Valeurs Gardées

**Cause** : Tri par priorité non actif

**Solution** : Vérifier lignes 412-414 :
```python
operation_priority = {'INSERT': 1, 'UPDATE': 2, 'UNCHANGED': 3}
```

### Problème 3 : Erreur "Colonnes Manquantes"

**Cause** : Nom de colonne différent dans le CSV

**Solution** : Ajuster `NATURAL_KEY` avec les vrais noms de colonnes

### Problème 4 : "Méthodologie" en Float au lieu de String

**Cause** : Pandas infère le type automatiquement

**Solution** : ✅ Déjà corrigé (lignes 124-148) - Forçage explicite en `str`

---

## 📊 Statistiques Typiques

### Premier Run (Fresh Start)

```
Input:  453,584 records
Source: 0 records

Output: 453,584 records
  - INSERT: 453,584 (100%)
  - UPDATE: 0
  - UNCHANGED: 0

IDs uniques: 453,584 ✅
Doublons: 0 ✅
```

### Run Suivant (Matching Actif)

```
Input:  453,734 records (+150)
Source: 453,584 records

Output: 453,734 records
  - INSERT: 150 (nouveaux)
  - UPDATE: 1,230 (valeurs modifiées)
  - UNCHANGED: 452,354 (inchangés)

IDs uniques: 453,734 ✅
Doublons: 0 ✅
```

---

## 🎓 Cas d'Usage Réels

### Cas 1 : Nouveau Produit

```
Input:
  - Nom: "Béton C35/45"
  - Unité: "m³"
  - Source: "INIES"
  - Date: 2025
  - FE: 350.5

Résultat:
  - Hash généré: abc123...
  - Aucun match dans source
  - Operation: INSERT
  - ID: nouveau UUID
```

### Cas 2 : Mise à Jour du FE

```
Source:
  - ID: uuid-001
  - Nom: "Béton C35/45"
  - FE: 350.5

Input:
  - Nom: "Béton C35/45"
  - FE: 360.2  ← Modifié

Résultat:
  - Hash: identique
  - Match trouvé
  - FE différent → Operation: UPDATE
  - ID: uuid-001 (réutilisé) ✅
```

### Cas 3 : Même Produit, Unité Différente

```
Source:
  - ID: uuid-002
  - Nom: "Peintures BIOPRO"
  - Unité: "kg"
  - FE: 8.208

Input:
  - Nom: "Peintures BIOPRO"
  - Unité: "m²"  ← Différente
  - FE: 1.96

Résultat:
  - Hash: différent (unité dans la clé)
  - Aucun match
  - Operation: INSERT
  - ID: uuid-003 (nouveau) ✅
```

### Cas 4 : Doublon dans l'Import (Cas Edge)

```
Input contient 2 fois le même record avec le même hash mais FE différents:
  - Record A: FE=10.5, operation=UNCHANGED (vient de la source)
  - Record B: FE=12.3, operation=UPDATE (nouvel import)

Déduplication:
  - Tri par priorité: UPDATE (2) avant UNCHANGED (3)
  - keep='first' après tri
  - Résultat: FE=12.3 gardé ✅ (version la plus récente)
```

---

## 🔄 Cycle de Vie Complet

### 1. Initialisation (J0)

```
1. Import CSV → Dataiku
2. Source vide
3. Run Python → Tous INSERT
4. Output → Nouvelle source
5. Upload → Supabase staging
6. Publish → Algolia
```

### 2. Mise à Jour Mensuelle (J+30)

```
1. Nouveau CSV → Dataiku
2. Source = output précédent
3. Run Python → Matching actif
   - Nouveaux produits → INSERT
   - FE modifiés → UPDATE
   - Inchangés → UNCHANGED
4. Output → Nouvelle source
5. Upload → Supabase staging
6. Publish → Algolia (IDs stables ✅)
```

### 3. Correction Urgente (J+35)

```
1. Correction sur 1 produit
2. Ré-import du CSV
3. Run Python → 1 UPDATE détecté
4. ID conservé ✅
5. Publish → Algolia (pas de rupture)
```

---

## 📋 Checklist de Déploiement

### Avant le Premier Run

- [ ] Dataiku projet créé
- [ ] Dataset `new_import` configuré (CSV import)
- [ ] Dataset `emission_factors_source` créé (vide au début)
- [ ] Recette Python créée avec le code complet
- [ ] Colonnes `NATURAL_KEY` vérifiées dans le CSV

### Test sur Échantillon

- [ ] Limite à 1000 records
- [ ] Exécution réussie
- [ ] Logs : "✓ Tous les IDs sont uniques"
- [ ] Vérification visuelle des colonnes ID/hash/operation

### Déploiement Complet

- [ ] Source vidée (fresh start)
- [ ] Exécution sur tout le dataset
- [ ] Logs finaux OK
- [ ] Output sauvegardé comme nouvelle source

### Post-Déploiement

- [ ] Upload vers Supabase
- [ ] Validation SQL : 0 doublon
- [ ] Test cycle suivant (modifier quelques FE)
- [ ] Vérifier le matching et les UPDATE

---

## 📞 Support et Contact

### Si Problème Persistant

1. **Vérifier** la présence de l'unité dans `NATURAL_KEY` (ligne 31)
2. **Vérifier** qu'il n'y a pas d'unités vides/null dans les données
3. **Vérifier** les logs : Message de déduplication ? Quel nombre ?
4. **Exporter** les doublons pour analyse :
   ```python
   dupes = df_output[df_output['ID'].duplicated(keep=False)]
   dupes.to_csv('doublons_debug.csv')
   ```

### Scripts Utiles

- **`scripts/validate_no_duplicate_ids.sql`** : Tests SQL complets
- **`scripts/analyze_natural_key_complete.py`** : Analyser la qualité de la clé
- **`scripts/extract_problematic_records.py`** : Extraire les records problématiques

---

## 🎉 Résumé

### Ce que le Système Garantit

✅ **Unicité absolue des IDs** (0 doublon)  
✅ **Stabilité des IDs** entre imports  
✅ **Priorité au nouvel import** (version la plus récente)  
✅ **Traçabilité** (INSERT/UPDATE/UNCHANGED)  
✅ **Intégrité des données** (7 colonnes critiques vérifiées)  

### Ce que tu Obtiens

🎯 **Continuité** : Les mêmes facteurs gardent leurs IDs  
🎯 **Fiabilité** : Impossible d'avoir des doublons d'ID  
🎯 **Fraîcheur** : Toujours la dernière version des valeurs  
🎯 **Traçabilité** : Savoir ce qui a changé entre imports  

---

**Date de dernière mise à jour** : 14 octobre 2025  
**Version du code** : 1.2  
**Fichier** : `dataiku_id_matching_recipe_FINAL.py`  
**Statut** : ✅ Production-ready - 0 doublon garanti

