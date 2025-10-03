# 📥 Instructions d'export des vrais doublons

**Date**: 2025-10-02  
**Total à exporter**: 8,837 lignes (3,584 conservées + 5,253 éliminées)

---

## 🎯 Méthode recommandée : Interface SQL Supabase

### Étapes

1. **Ouvrir l'interface SQL**
   - Aller sur https://supabase.com/dashboard
   - Sélectionner votre projet
   - Aller dans "SQL Editor"

2. **Copier-coller la requête**
   - Ouvrir le fichier `scripts/export_vrais_doublons_complet.sql`
   - Copier l'intégralité de la requête
   - Coller dans l'éditeur SQL

3. **Exécuter et télécharger**
   - Cliquer sur "Run" ou `Ctrl+Enter`
   - Attendre les résultats (peut prendre 10-30 secondes)
   - Cliquer sur **"Download CSV"** en haut à droite des résultats

4. **Fichier obtenu**
   - Format : CSV UTF-8
   - Nom suggéré : `vrais_doublons_complet_YYYYMMDD.csv`
   - Taille attendue : ~2-3 MB

---

## 📊 Structure du fichier exporté

| Colonne | Description | Exemple |
|---------|-------------|---------|
| **ID** | ID original du record | "abc123..." |
| **Nom** | Nom du facteur (FR) | "Lait de chèvre" |
| **Nom_en** | Nom du facteur (EN) | "Goats Milk" |
| **FE** | Valeur du facteur d'émission | "0.000" |
| **Unite** | Unité | "kg" |
| **Source** | Source de données | "WRAP" |
| **Date** | Année | "2010" |
| **Perimetre** | Périmètre | "Changement d'affectation des terres" |
| **Localisation** | Localisation | "global" |
| **Contributeur** | Contributeur | "GLEAM-i" |
| **Description_court** | Description (100 premiers caractères) | "Data retrieved from..." |
| **Nombre_total_doublons** | Nombre de copies du record | "12" |
| **Position_dans_groupe** | Position dans le groupe | "1", "2", "3"... |
| **Statut** | Action de déduplication | "CONSERVÉ" ou "ÉLIMINÉ" |

---

## 🔍 Statistiques attendues

```
Total lignes exportées : 8,837
├─ CONSERVÉES : 3,584 (première occurrence de chaque groupe)
└─ ÉLIMINÉES  : 5,253 (doublons à supprimer)

Groupes de doublons : 3,584
├─ Maximum de copies dans un groupe : 12
└─ Moyenne de copies par groupe : ~2.5
```

---

## 📈 Analyse par source

| Source | Lignes dupliquées | Lignes à éliminer |
|--------|------------------|-------------------|
| PCAF | 14,427 | 10,154 |
| EEA | 3,979 | 2,044 |
| WRAP | 1,368 | 998 |
| INIES | 1,168 | 632 |
| CBAM | 1,104 | 564 |
| BEIS | 890 | 466 |
| Base Carbone v23.6 | 702 | 402 |
| Autres (8 sources) | 1,199 | 593 |

---

## 🛠️ Méthodes alternatives

### Méthode 2 : Script Python (si interface Supabase ne marche pas)

```bash
# Installer requests si nécessaire
pip3 install requests

# Configurer les variables d'environnement
export VITE_SUPABASE_URL="https://votre-projet.supabase.co"
export VITE_SUPABASE_ANON_KEY="votre-anon-key"

# Exécuter le script
python3 scripts/export_vrais_doublons_csv.py
```

**Note**: Le script Python est limité à 10,000 lignes. Pour l'export complet (8,837 lignes), il fonctionnera sans problème.

### Méthode 3 : psql (ligne de commande)

```bash
# Se connecter à la base
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres"

# Exécuter la requête et rediriger vers CSV
\copy (SELECT ... FROM ...) TO 'vrais_doublons.csv' WITH CSV HEADER;
```

---

## 📋 Utilisation du fichier exporté

### Filtrer par source
```excel
# Dans Excel/Numbers
Filtre colonne "Source" = "WRAP"
```

### Voir uniquement les éliminés
```excel
Filtre colonne "Statut" = "ÉLIMINÉ"
```

### Compter les doublons par source
```excel
Tableau croisé dynamique:
- Lignes: Source
- Valeurs: Nombre de ID (distinct)
```

---

## ✅ Validation

Après export, vérifier :
- ✅ Nombre total de lignes = **8,837**
- ✅ Lignes avec Statut="CONSERVÉ" = **3,584**
- ✅ Lignes avec Statut="ÉLIMINÉ" = **5,253**
- ✅ Toutes les sources sont présentes

---

## 🆘 Dépannage

### Erreur "timeout"
→ La requête est trop longue. Utiliser la méthode Python ou exporter par lots.

### Résultats tronqués
→ L'interface Supabase limite parfois à 500-1000 lignes affichées, mais le CSV complet est bien téléchargé.

### Caractères mal encodés
→ S'assurer d'ouvrir le CSV en UTF-8 dans Excel/Numbers.

---

## 📞 Support

Pour toute question sur l'export ou l'analyse des doublons, voir :
- `2025-10-02_vrais_doublons_export.md` - Analyse détaillée
- `2025-10-02_BUG_CRITIQUE_factor_key_fix.md` - Distinction vrais/faux doublons

