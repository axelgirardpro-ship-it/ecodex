# 🔧 Système de Matching d'ID Dataiku

## 📚 Documentation

**Guide complet** : [`GUIDE_DATAIKU_ID_MATCHING.md`](./GUIDE_DATAIKU_ID_MATCHING.md)

## 📂 Fichiers

### Code Python
- **`dataiku_id_matching_recipe_FINAL.py`** - Code production (copier-coller dans Dataiku)

### Scripts de Validation
- **`scripts/validate_no_duplicate_ids.sql`** - Tests SQL après upload Supabase

### Analyse (Optionnel)
- `scripts/analyze_natural_key_complete.py` - Analyser la qualité de la clé naturelle
- `scripts/extract_problematic_records.py` - Extraire les records problématiques

## ⚡ Quick Start

1. **Lire** : `GUIDE_DATAIKU_ID_MATCHING.md`
2. **Copier** : Le code de `dataiku_id_matching_recipe_FINAL.py`
3. **Coller** : Dans ta recette Python Dataiku
4. **Lancer** : Et vérifier les logs

## ✅ Garanties

- ✅ **0 doublon d'ID** (garanti mathématiquement)
- ✅ **IDs stables** entre imports
- ✅ **Priorité au nouvel import** (version la plus récente)

---

**Version** : 2.0  
**Date** : Octobre 2025  
**Statut** : Production-ready

