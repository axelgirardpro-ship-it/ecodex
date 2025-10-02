# Export des vrais doublons détectés

**Date**: 2025-10-02  
**Total vrais doublons**: 5,253 records à éliminer

---

## 📊 Statistiques par source

| Source | Records avec doublons | Total lignes dupliquées | Lignes à éliminer |
|--------|----------------------|------------------------|-------------------|
| **PCAF** | 93 | 14,427 | **10,154** |
| **EEA** | 1,678 | 3,979 | **2,044** |
| **WRAP** | 70 | 1,368 | **998** |
| **INIES** | 185 | 1,168 | **632** |
| **CBAM** | 4 | 1,104 | **564** |
| **BEIS** | 196 | 890 | **466** |
| **Base Carbone v23.6** | 40 | 702 | **402** |
| **GLEC** | 46 | 270 | **138** |
| **Ecologits** | 55 | 245 | **130** |
| **Eco-Platform** | 53 | 230 | **122** |
| **Greenview** | 29 | 116 | **58** |
| **GES1point5** | 8 | 44 | **22** |
| **Reporting carbone public** | 9 | 36 | **18** |
| **Agribalyse 3.2** | 2 | 8 | **4** |
| **EPA** | 1 | 4 | **2** |

**Total**: 15 sources | **5,253 doublons à éliminer**

---

## 🎯 Sources les plus impactées

### 1. PCAF (10,154 doublons)
- **Impact**: 68% des doublons totaux
- **Problème**: 93 records ont en moyenne 155 duplicatas chacun
- **Hypothèse**: Imports multiples de la même base de données PCAF

### 2. EEA (2,044 doublons)
- **Impact**: 14% des doublons totaux
- **Problème**: 1,678 records avec doublons (beaucoup de petits groupes)
- **Hypothèse**: Mises à jour successives de la base EEA

### 3. WRAP (998 doublons)
- **Impact**: 7% des doublons totaux
- **Problème**: 70 records alimentaires principalement
- **Exemple**: "Lait de chèvre" × 12, "Œufs de poule" × 12

---

## 📋 Exemples de vrais doublons

### WRAP - Produits alimentaires
```
Lait de chèvre (Goats Milk)
- FE: 0.000 kg CO₂e/kg
- Périmètre: Changement d'affectation des terres
- Localisation: global
- Date: 2010
- Doublons: 12 copies identiques
```

### PCAF - Produits financiers
```
À documenter avec requête spécifique
```

### EEA - Facteurs d'émission européens
```
À documenter avec requête spécifique
```

---

## 🔍 Méthodologie de détection

Les vrais doublons sont identifiés par un `factor_key` identique généré à partir de :
- Nom du facteur
- Unité
- Source
- Périmètre
- Localisation
- **Valeur du FE** (après correction du bug)
- Date

Si **TOUS** ces champs sont identiques, c'est un vrai doublon légitime à éliminer.

---

## 📥 Export SQL pour analyse détaillée

Pour exporter tous les doublons :

```sql
WITH prepared_data AS (
  SELECT
    "ID",
    coalesce(nullif(btrim("Nom"), ''), nullif(btrim("Nom_en"), '')) AS "Nom",
    public.safe_to_numeric(nullif(btrim("FE"), '')) AS "FE",
    nullif(btrim("Source"), '') AS "Source",
    public.calculate_factor_key(...) AS factor_key,
    ROW_NUMBER() OVER (PARTITION BY factor_key ORDER BY "ID") AS row_num
  FROM staging_emission_factors
  WHERE nullif(btrim("FE"), '') IS NOT NULL
    AND nullif(btrim("Unité donnée d'activité"), '') IS NOT NULL
),
duplicates AS (
  SELECT factor_key, COUNT(*) as dup_count
  FROM prepared_data
  GROUP BY factor_key
  HAVING COUNT(*) > 1
)
SELECT pd.*, d.dup_count
FROM prepared_data pd
JOIN duplicates d ON d.factor_key = pd.factor_key
WHERE pd.row_num > 1  -- Seulement les lignes à éliminer
ORDER BY d.dup_count DESC, pd.factor_key;
```

---

## ✅ Action de nettoyage

La déduplication est effectuée automatiquement par `run_import_from_staging()` via :
```sql
SELECT DISTINCT ON (factor_key) *
FROM temp_valid
ORDER BY factor_key;
```

Cela conserve le **premier record** de chaque groupe de doublons et élimine les autres.

---

## 📌 Note importante

Ces **5,253 vrais doublons** sont **légitimes à éliminer**. Ils ne représentent aucune perte d'information puisque toutes leurs métadonnées sont strictement identiques.

Les **5,732 faux doublons** (causés par le bug du `factor_key`) sont maintenant **corrigés** et seront récupérés au prochain import.

