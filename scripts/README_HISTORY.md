# Documentation du Système d'Historique

## 📋 Vue d'ensemble

Ce dossier contient un script automatisé pour gérer l'historique des documentations du projet.

## 🎯 Objectif

- Organiser automatiquement les fichiers `.md` de documentation
- Maintenir un CHANGELOG à jour
- Créer un index chronologique des documents
- Faciliter la recherche et la navigation dans l'historique

## 📁 Structure

```
/datacarb
├── CHANGELOG.md                 # Changelog principal (format Keep a Changelog)
├── docs/
│   └── history/
│       ├── INDEX.md             # Index chronologique de tous les documents
│       ├── 2025-10-22_PLAN_BENCHMARK_FEATURE.md
│       ├── 2025-10-20_HOTFIX_FILTRE_PRIVATE.md
│       └── ...                  # Tous les documents historiques
└── scripts/
    ├── add-to-history.sh        # Script d'automatisation
    └── README_HISTORY.md        # Cette documentation
```

## 🚀 Utilisation du Script

### Commande de base

```bash
./scripts/add-to-history.sh <fichier.md> "<description>"
```

### Exemples

```bash
# Ajouter un rapport d'analyse
./scripts/add-to-history.sh RAPPORT_ANALYSE_PERFORMANCE.md "Analyse complète des performances"

# Ajouter un hotfix
./scripts/add-to-history.sh HOTFIX_CORRECTION_BUG.md "Correction du bug de synchronisation"

# Ajouter une documentation de feature
./scripts/add-to-history.sh FEATURE_NOUVELLE_FONCTION.md "Documentation de la nouvelle fonctionnalité XYZ"
```

### Ce que fait le script

1. ✅ **Vérifie** que le fichier existe et est bien un `.md`
2. ✅ **Renomme** le fichier avec la date du jour : `YYYY-MM-DD_NOM_ORIGINAL.md`
3. ✅ **Déplace** le fichier vers `docs/history/`
4. ✅ **Met à jour** automatiquement le `CHANGELOG.md`
5. ✅ **Met à jour** automatiquement le `docs/history/INDEX.md`
6. ✅ **Met à jour** les statistiques (nombre total de documents)
7. ✅ **Affiche** un résumé de l'opération

## 📝 Convention de Nommage

### Catégories automatiques

Le script détecte automatiquement la catégorie basée sur le préfixe du fichier :

| Préfixe | Catégorie | Icône | Exemple |
|---------|-----------|-------|---------|
| `HOTFIX_` | Hotfix | 🐛 | `HOTFIX_CORRECTION_BUG.md` |
| `OPTIMISATION_` | Optimisation | ⚡ | `OPTIMISATION_PERFORMANCE.md` |
| `FEATURE_` | Feature | 🎯 | `FEATURE_NOUVELLE_FONCTION.md` |
| `MIGRATION_` | Migration | 📦 | `MIGRATION_BASE_DONNEES.md` |
| `TEST_` | Tests | 🧪 | `TEST_INTEGRATION.md` |
| `PHASE_` | Feature | 🎯 | `PHASE5_INTEGRATION.md` |
| `RAPPORT_` | Rapport | 📊 | `RAPPORT_ANALYSE.md` |
| Autre | Rapport | 📊 | `DOCUMENTATION_GENERALE.md` |

### Format recommandé

```
<CATEGORIE>_<DESCRIPTION_COURTE>_<DETAILS>.md
```

**Exemples** :
- ✅ `HOTFIX_FILTRE_PRIVATE_ALGOLIA.md`
- ✅ `OPTIMISATION_REACT_QUERY_COMPLETE.md`
- ✅ `RAPPORT_ANALYSE_PERFORMANCE_20251020.md`
- ❌ `mon-document.md` (pas de catégorie)
- ❌ `doc.md` (nom trop court)

## 🔄 Workflow Recommandé

### Lors d'un nouveau build/changement majeur

1. **Créer** votre document de documentation :
   ```bash
   # Dans la racine du projet
   touch RAPPORT_NOUVELLE_FEATURE.md
   # Remplir le contenu...
   ```

2. **Ajouter** à l'historique :
   ```bash
   ./scripts/add-to-history.sh RAPPORT_NOUVELLE_FEATURE.md "Documentation complète de la nouvelle feature XYZ"
   ```

3. **Vérifier** les modifications :
   ```bash
   git diff CHANGELOG.md
   git diff docs/history/INDEX.md
   ```

4. **Commit** :
   ```bash
   git add .
   git commit -m "docs: ajout de RAPPORT_NOUVELLE_FEATURE à l'historique"
   ```

### À la fin de chaque sprint

1. **Vérifier** qu'aucun fichier `.md` ne traîne à la racine :
   ```bash
   ls -1 *.md | grep -v "README.md" | grep -v "CHANGELOG.md"
   ```

2. **Ajouter** les documents manquants à l'historique

3. **Mettre à jour** le CHANGELOG avec la nouvelle version

## 📊 Statistiques et Maintenance

### Voir les statistiques

Les statistiques sont automatiquement mises à jour dans `docs/history/INDEX.md` :
- Total de documents indexés
- Répartition par catégorie
- Dernière mise à jour

### Rechercher dans l'historique

```bash
# Rechercher un mot-clé dans tous les documents historiques
grep -r "mot-clé" docs/history/

# Lister tous les documents d'un mois
ls docs/history/2025-10-*

# Lister tous les hotfixes
ls docs/history/*HOTFIX*
```

## 🎯 Bonnes Pratiques

### ✅ À faire

- **Nommer clairement** vos documents avec un préfixe de catégorie
- **Ajouter une description** précise lors de l'ajout à l'historique
- **Vérifier** les modifications avant de commit
- **Garder** le CHANGELOG à jour avec les versions
- **Utiliser** le script pour automatiser

### ❌ À éviter

- Ne **jamais** supprimer des documents de `docs/history/`
- Ne **jamais** modifier manuellement les dates dans les noms de fichiers
- Ne **pas** laisser trainer des `.md` à la racine sans les documenter
- Ne **pas** oublier de commit après l'ajout d'un document

## 🔍 Dépannage

### Le script dit "fichier n'existe pas"

Vérifiez que vous êtes à la racine du projet et que le chemin est correct :
```bash
pwd  # Doit afficher : /Users/.../datacarb
ls VOTRE_FICHIER.md  # Doit le trouver
```

### Le script dit "permission denied"

Rendez le script exécutable :
```bash
chmod +x scripts/add-to-history.sh
```

### Erreur "sed: command not found"

Sur Linux, modifiez le script pour enlever le `''` après `sed -i` :
```bash
# Ligne 86 et suivantes
sed -i "/## \[Non publié\]/a\\  # Au lieu de sed -i ''
```

## 📚 Ressources

- **Keep a Changelog** : https://keepachangelog.com/fr/1.0.0/
- **Semantic Versioning** : https://semver.org/lang/fr/
- **Convention de Commit** : https://www.conventionalcommits.org/fr/

## 🤝 Support

Pour toute question ou problème :
1. Consulter cette documentation
2. Vérifier les exemples dans `docs/history/INDEX.md`
3. Consulter le CHANGELOG.md pour voir des exemples

---

**Version** : 1.0
**Dernière mise à jour** : 2025-10-22
**Mainteneur** : Équipe DataCarb


