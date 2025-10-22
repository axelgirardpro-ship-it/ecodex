# 📚 Historique des Documentations - DataCarb

Bienvenue dans l'historique centralisé de toutes les documentations de développement du projet DataCarb.

## 🎯 Objectif

Ce dossier contient **tous les documents historiques** du projet, organisés chronologiquement pour faciliter :
- La traçabilité des changements
- La compréhension de l'évolution du projet
- L'onboarding des nouveaux développeurs
- Le contexte pour les agents IA

## 📋 Navigation

- **[INDEX.md](./INDEX.md)** - Index chronologique complet de tous les documents
- **[../CHANGELOG.md](../../CHANGELOG.md)** - Changelog principal du projet

## 📁 Organisation

Tous les fichiers suivent le format : `YYYY-MM-DD_NOM_DOCUMENT.md`

### Exemple
```
2025-10-22_PLAN_BENCHMARK_FEATURE.md
2025-10-20_HOTFIX_FILTRE_PRIVATE_ALGOLIA.md
2025-10-16_OPTIMISATION_REACT_QUERY_COMPLETE.md
```

## 🏷️ Catégories

Les documents sont classés par catégorie :

| Icône | Catégorie | Description |
|-------|-----------|-------------|
| 🎯 | Feature | Nouvelles fonctionnalités |
| 🐛 | Hotfix | Corrections urgentes |
| ⚡ | Optimisation | Améliorations de performance |
| 📊 | Rapport | Analyses et diagnostics |
| 🧪 | Tests | Documentation de tests |
| 📦 | Migration | Migrations de base de données |
| 🧹 | Maintenance | Nettoyage et maintenance |

## 🔍 Recherche

### Par date
```bash
ls 2025-10-*
```

### Par catégorie
```bash
ls *HOTFIX*
ls *OPTIMISATION*
ls *RAPPORT*
```

### Par mot-clé
```bash
grep -r "React Query" .
grep -r "Algolia" .
```

## 📊 Statistiques

**Total de documents** : 34

Voir [INDEX.md](./INDEX.md) pour les statistiques détaillées.

## ➕ Ajouter un Document

**NE PAS** ajouter manuellement les fichiers ici !

Utilisez le script d'automatisation :
```bash
./scripts/add-to-history.sh <fichier.md> "<description>"
```

Documentation complète : [scripts/README_HISTORY.md](../../scripts/README_HISTORY.md)

## 📚 Documents Principaux

### Octobre 2025

#### Feature Benchmark (2025-10-22)
- Plan complet d'implémentation
- Statut des composants (17 composants créés)
- Phase 5 : Intégration & Navigation
- Phase 7 : Tests & Corrections

#### Optimisations Performance (2025-10-20)
- Rapport query performance (+99% amélioration)
- Optimisation autovacuum
- Optimisation webhook (-96% temps UPDATE)
- Optimisation Realtime (-90% appels)
- Corrections Security Advisors (+91%)

#### React Query Migration (2025-10-16)
- Optimisation complète (-83% requêtes réseau)
- Analyse réseau post-optimisation
- Guide de tests visuels
- Corrections Realtime et quotas

#### Hotfixes Algolia (2025-10-20)
- Filtre Private (0 résultats corrigé)
- User overlays dans Algolia
- Diagnostic complet

#### Base de données (2025-10-15)
- Migration champs de score Algolia
- Comparatif Vector DB (Pinecone vs Qdrant vs pgvector)
- Nettoyage legacy (~80 fichiers)

## 🔗 Liens Utiles

- [CHANGELOG.md](../../CHANGELOG.md) - Changelog principal
- [INDEX.md](./INDEX.md) - Index chronologique
- [README_HISTORY.md](../../scripts/README_HISTORY.md) - Documentation du système

---

**Créé le** : 2025-10-22  
**Dernière mise à jour** : 2025-10-22  
**Mainteneur** : Équipe DataCarb


