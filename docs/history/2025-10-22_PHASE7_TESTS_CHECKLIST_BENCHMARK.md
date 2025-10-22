# Phase 7 : Tests & Polish - Checklist Complète

## ✅ Corrections Immédiates

### 1. Export default BenchmarkPage ✅
- [x] **CORRIGÉ** : Ajout de `export default BenchmarkPage` dans `/src/pages/BenchmarkPage.tsx`
- [x] Vérifié : Aucune erreur de linter

---

## 🧪 Tests Fonctionnels

### A. Tests de Génération de Benchmark

#### A1. Validation des Prérequis
- [ ] **Test : Unité unique**
  - Effectuer une recherche retournant plusieurs unités
  - Cliquer sur "Générer un benchmark"
  - **Attendu** : Message d'erreur "Plusieurs unités détectées"

- [ ] **Test : Périmètre unique**
  - Effectuer une recherche retournant plusieurs périmètres
  - Cliquer sur "Générer un benchmark"
  - **Attendu** : Message d'erreur "Plusieurs périmètres détectés"

- [ ] **Test : Validation OK**
  - Effectuer une recherche avec 1 unité + 1 périmètre
  - Cliquer sur "Générer un benchmark"
  - **Attendu** : Génération réussie, affichage du benchmark

#### A2. Exclusions et Filtres
- [ ] **Test : FE floutés exclus**
  - Recherche incluant des FE floutés
  - Générer benchmark
  - **Attendu** : FE floutés non présents dans le benchmark

- [ ] **Test : Sources payantes non assignées**
  - User Freemium sans assignment source payante
  - Recherche incluant FE de source payante
  - **Attendu** : FE de source payante non présents dans le benchmark

- [ ] **Test : Sources payantes assignées**
  - User avec assignment source payante
  - Recherche incluant FE de cette source
  - **Attendu** : FE de source payante présents dans le benchmark

#### A3. Limite Algolia
- [ ] **Test : Requête > 1000 hits**
  - Recherche très large (> 1000 résultats)
  - Générer benchmark
  - **Attendu** : Limité à 1000 FE, message si pertinent

---

### B. Tests des Quotas

#### B1. Freemium - Trial Actif
- [ ] **Test : Premier benchmark (0/3)**
  - User Freemium en trial
  - Vérifier navbar : "0/3"
  - Générer benchmark
  - **Attendu** : Génération OK, navbar passe à "1/3"

- [ ] **Test : Deuxième benchmark (1/3)**
  - Générer un 2ème benchmark
  - **Attendu** : Génération OK, navbar passe à "2/3"

- [ ] **Test : Troisième benchmark (2/3)**
  - Générer un 3ème benchmark
  - **Attendu** : Génération OK, navbar passe à "3/3"

- [ ] **Test : Quatrième benchmark (3/3)**
  - Essayer de générer un 4ème benchmark
  - **Attendu** : Bouton désactivé, tooltip "Quota dépassé (3/3)"

#### B2. Freemium - Trial Expiré
- [ ] **Test : Après expiration trial**
  - User Freemium avec trial expiré
  - **Attendu** : Bouton désactivé, tooltip "Trial expiré, passez à Pro"

#### B3. Pro - Illimité
- [ ] **Test : User Pro**
  - User avec plan Pro
  - Vérifier navbar : "Illimité"
  - Générer plusieurs benchmarks (>3)
  - **Attendu** : Toujours possible, pas de limite

---

### C. Tests de l'Interface Utilisateur

#### C1. Bouton "Générer un benchmark"
- [ ] **Test : Query vide**
  - Page `/search` sans recherche
  - **Attendu** : Bouton désactivé, tooltip "Veuillez effectuer une recherche"

- [ ] **Test : 0 résultats**
  - Recherche sans résultats
  - **Attendu** : Bouton désactivé, tooltip "Aucun résultat trouvé"

- [ ] **Test : Résultats valides**
  - Recherche avec résultats
  - **Attendu** : Bouton actif

#### C2. Page Benchmark - Graphique
- [ ] **Test : Sélecteur 24 points**
  - Cliquer sur "24"
  - **Attendu** : Graphique affiche ~24 points (Top 10, Q1, Médiane, Q3, Worst 10)

- [ ] **Test : Sélecteur 50 points**
  - Cliquer sur "50"
  - **Attendu** : Graphique affiche 50 points

- [ ] **Test : Sélecteur 100 points**
  - Cliquer sur "100"
  - **Attendu** : Graphique affiche 100 points ou tous si < 100

- [ ] **Test : Toggle tri croissant**
  - Par défaut ordre croissant (FE faibles → FE élevés)
  - **Attendu** : Barres du graphique vont de gauche (faible) à droite (élevé)

- [ ] **Test : Toggle tri décroissant**
  - Cliquer sur toggle tri
  - **Attendu** : Barres inversées, ordre décroissant

- [ ] **Test : Click sur barre**
  - Cliquer sur une barre du graphique
  - **Attendu** : Modal s'ouvre avec détails complets du FE

#### C3. Page Benchmark - Statistiques
- [ ] **Test : Affichage 9 stats**
  - **Attendu** : 9 cartes visibles (Médiane, Q1, Q3, Min, Max, Moyenne, Écart-type, IQR, Plage %)

- [ ] **Test : Médiane mise en avant**
  - **Attendu** : Card Médiane avec bordure primary et police en gras

- [ ] **Test : Tooltips statistiques**
  - Hover sur icône (?) de chaque stat
  - **Attendu** : Tooltip explicatif s'affiche

#### C4. Page Benchmark - Tables
- [ ] **Test : Table Top 10**
  - **Attendu** : 10 FE avec valeurs les plus faibles
  - Bordure verte à gauche

- [ ] **Test : Table Worst 10**
  - **Attendu** : 10 FE avec valeurs les plus élevées
  - Bordure rouge à gauche

- [ ] **Test : Click sur ligne table**
  - Cliquer sur une ligne
  - **Attendu** : Modal détails FE s'ouvre

#### C5. Page Benchmark - Metadata & Warnings
- [ ] **Test : Metadata affichée**
  - **Attendu** : Unité, Périmètre, Taille échantillon, Sources, Période

- [ ] **Test : Warning sources multiples**
  - Benchmark avec plusieurs sources
  - **Attendu** : Warning visible en bleu

- [ ] **Test : Warning grand échantillon**
  - Benchmark avec > 500 FE
  - **Attendu** : Warning visible en amber

---

### D. Tests de Sauvegarde & Historique

#### D1. Sauvegarde
- [ ] **Test : Sauvegarder sans titre**
  - Cliquer sur "Sauvegarder"
  - Laisser titre vide
  - Valider
  - **Attendu** : Message d'erreur "Titre requis"

- [ ] **Test : Sauvegarder avec titre**
  - Entrer un titre
  - Valider
  - **Attendu** : Benchmark sauvegardé, toast succès, navigation vers `/benchmark/:id`

- [ ] **Test : Bouton "Sauvegarder" disparaît**
  - Après sauvegarde
  - **Attendu** : Bouton "Sauvegarder" n'est plus visible

#### D2. Historique
- [ ] **Test : Ouvrir dropdown historique**
  - Cliquer sur "Historique"
  - **Attendu** : Dropdown s'ouvre avec liste des benchmarks

- [ ] **Test : Historique vide**
  - User sans benchmarks sauvegardés
  - **Attendu** : Message "Aucun benchmark sauvegardé"

- [ ] **Test : Charger depuis historique**
  - Cliquer sur un benchmark dans l'historique
  - **Attendu** : Navigation vers `/benchmark/:id`, benchmark chargé

- [ ] **Test : Supprimer depuis historique**
  - Cliquer sur icône poubelle
  - Confirmer
  - **Attendu** : Benchmark supprimé, toast succès

---

### E. Tests d'Export

#### E1. Export PNG
- [ ] **Test : Export PNG réussit**
  - Cliquer sur "Exporter" → "PNG"
  - **Attendu** : Fichier PNG téléchargé, toast succès

- [ ] **Test : Qualité PNG**
  - Ouvrir le PNG téléchargé
  - **Attendu** : Haute résolution (scale: 2), texte lisible

#### E2. Export PDF
- [ ] **Test : Export PDF réussit**
  - Cliquer sur "Exporter" → "PDF"
  - **Attendu** : Fichier PDF téléchargé, toast succès

- [ ] **Test : Contenu PDF**
  - Ouvrir le PDF
  - **Attendu** : 
    - Metadata complète
    - Statistiques
    - Tables Top 10 & Worst 10
    - Warnings si présents
    - Mise en page professionnelle

---

### F. Tests de Partage

#### F1. Partage URL
- [ ] **Test : Ouvrir modal partage**
  - Cliquer sur "Partager"
  - **Attendu** : Modal s'ouvre avec URL

- [ ] **Test : Copier URL**
  - Cliquer sur bouton copier
  - **Attendu** : URL copiée, toast succès, icône devient check

- [ ] **Test : URL fonctionnelle**
  - Ouvrir l'URL copiée dans un nouvel onglet
  - **Attendu** : Benchmark chargé (si user a accès au workspace)

---

### G. Tests de Navigation

#### G1. Navigation Search → Benchmark
- [ ] **Test : Navigation avec paramètres**
  - Effectuer recherche avec filtres
  - Cliquer "Générer un benchmark"
  - **Attendu** : Navigation vers `/benchmark?query=...&filters=...`

- [ ] **Test : Paramètres préservés**
  - Vérifier que le benchmark généré correspond exactement à la recherche
  - **Attendu** : Mêmes filtres appliqués

#### G2. Navigation Historique → Benchmark
- [ ] **Test : Charger benchmark sauvegardé**
  - Cliquer sur benchmark dans historique
  - **Attendu** : Navigation vers `/benchmark/:id`, données chargées

---

### H. Tests RLS & Permissions

#### H1. Row Level Security
- [ ] **Test : Benchmarks visibles workspace**
  - User A et User B dans même workspace
  - User A sauvegarde un benchmark
  - **Attendu** : User B voit le benchmark dans son historique

- [ ] **Test : Benchmarks invisibles autre workspace**
  - User A dans workspace 1
  - User B dans workspace 2
  - **Attendu** : User B ne voit pas les benchmarks de User A

- [ ] **Test : Modification par autre user**
  - User A sauvegarde benchmark
  - User B (même workspace) supprime le benchmark
  - **Attendu** : Suppression réussie (RLS workspace, pas user)

---

## 🎨 Tests UX & Polish

### I. Tests Responsive Desktop

#### I1. Résolution 1920x1080
- [ ] **Test : Layout général**
  - **Attendu** : Tous les éléments visibles, pas de scroll horizontal

- [ ] **Test : Graphique**
  - **Attendu** : Graphique prend toute la largeur disponible

- [ ] **Test : Tables**
  - **Attendu** : 2 tables côte à côte (Top 10, Worst 10)

#### I2. Résolution 1440x900
- [ ] **Test : Layout général**
  - **Attendu** : Adaptation correcte, éléments lisibles

#### I3. Résolution 1024x768 (minimum)
- [ ] **Test : Layout général**
  - **Attendu** : Layout responsive, tables peuvent passer en colonne

---

### J. Tests de Performance

#### J1. Temps de Génération
- [ ] **Test : Benchmark < 100 FE**
  - **Attendu** : < 2 secondes

- [ ] **Test : Benchmark 100-500 FE**
  - **Attendu** : < 5 secondes

- [ ] **Test : Benchmark > 500 FE**
  - **Attendu** : < 10 secondes, warning affiché

#### J2. Export Performance
- [ ] **Test : Export PNG**
  - **Attendu** : < 3 secondes

- [ ] **Test : Export PDF**
  - **Attendu** : < 5 secondes

---

### K. Tests d'Accessibilité

#### K1. Navigation Clavier
- [ ] **Test : Tab navigation**
  - Utiliser Tab pour naviguer
  - **Attendu** : Tous les éléments interactifs accessibles

- [ ] **Test : Esc ferme modals**
  - Ouvrir un modal
  - Appuyer sur Esc
  - **Attendu** : Modal se ferme

#### K2. Screen Reader
- [ ] **Test : Aria labels**
  - Vérifier avec screen reader
  - **Attendu** : Tous les éléments ont des labels appropriés

---

### L. Tests de Traduction

#### L1. Langue Française
- [ ] **Test : Toutes les clés FR**
  - Naviguer dans toute la feature
  - **Attendu** : Aucun texte en anglais

#### L2. Langue Anglaise
- [ ] **Test : Toutes les clés EN**
  - Changer langue vers EN
  - Naviguer dans toute la feature
  - **Attendu** : Toutes les traductions présentes

---

## 🐛 Tests de Gestion d'Erreurs

### M. Scénarios d'Erreur

#### M1. Erreurs API
- [ ] **Test : Edge Function timeout**
  - Simuler timeout
  - **Attendu** : Message d'erreur approprié, bouton "Retour à la recherche"

- [ ] **Test : Erreur Supabase**
  - Simuler erreur DB
  - **Attendu** : Message d'erreur générique

#### M2. Erreurs Réseau
- [ ] **Test : Perte de connexion**
  - Désactiver réseau pendant génération
  - **Attendu** : Message d'erreur réseau

---

## ✅ Checklist de Validation Finale

### Avant Production
- [ ] Tous les tests fonctionnels passent
- [ ] Aucune erreur console
- [ ] Aucune erreur TypeScript
- [ ] Traductions complètes FR/EN
- [ ] RLS vérifié et fonctionnel
- [ ] Quotas Freemium/Pro testés
- [ ] Exports PDF/PNG validés
- [ ] Performance acceptable
- [ ] Accessibilité de base respectée
- [ ] Documentation à jour

---

## 📊 Résumé de Progression

**Tests Passés** : 1/100+  
**Tests Échoués** : 0  
**Tests En Attente** : 99+  

---

**Date** : 22 octobre 2025  
**Phase** : 7/7 - Tests & Polish  
**Statut** : 🟡 EN COURS

