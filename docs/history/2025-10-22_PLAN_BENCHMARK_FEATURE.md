# Plan d'Implémentation - Feature Benchmark/Analyse
## Document de Validation Produit

---

## 🎯 Objectif

Créer une fonctionnalité complète de **benchmark/analyse des Facteurs d'Émission** permettant aux utilisateurs **Plan Pro** de :
- Analyser graphiquement les FE issus de leurs recherches Algolia
- Visualiser des statistiques détaillées (médiane, quartiles, top/worst 10)
- Exporter les résultats en PDF haute qualité
- Sauvegarder et partager les benchmarks au sein du workspace

---

## 🏗️ Architecture Globale

### Principe clé
Les paramètres de recherche sont transmis via **query params** depuis la page `/search`, garantissant une **cohérence parfaite** entre les résultats de recherche et le benchmark généré.

### Flow utilisateur
```
Page /search → User recherche → Résultats affichés
    ↓
Clic "Analyser / Benchmark" (bouton visible si Plan Pro)
    ↓
Navigation vers /benchmark avec paramètres (query, filters, facetFilters)
    ↓
Validation automatique (unité unique + périmètre unique)
    ↓
Si validation OK → Génération benchmark avec graphique et statistiques
    ↓
Options : Sauvegarder, Exporter PDF/PNG, Partager au workspace
```

---

## 💾 Backend - Edge Function

### Nouvelle Edge Function : `generate-benchmark`

**Endpoint :** `POST /functions/v1/generate-benchmark`

**Responsabilités :**

1. **Validation pré-Algolia (économie de crédits)**
   - Requête Algolia facets-only (`hitsPerPage: 0`) pour vérifier unicité unité/périmètre
   - Si validation échoue → Retour erreur immédiat SANS requête complète
   - Si validation OK → Requête complète (max 1000 hits)
   - **Avantage :** Économise des crédits Algolia en cas d'erreur de validation

2. **Filtrage sécurisé**
   - Exclure les FE avec `variant='teaser'` ou `is_blurred=true`
   - Vérifier les assignations workspace pour sources paid (`access_level='paid'`)
   - Seuls les FE accessibles à l'utilisateur sont inclus dans le benchmark

3. **Calculs statistiques**
   - Médiane, Q1 (25%), Q3 (75%)
   - Minimum, Maximum, Moyenne, Écart-type
   - Top 10 (valeurs les plus basses) et Worst 10 (valeurs les plus hautes)
   - Sélection de 24 points représentatifs pour le graphique

4. **Détection des warnings**
   - Sources multiples → Warning visible
   - Années multiples → Information contextuelle

**Validation stricte :**
- Unité non unique → Erreur bloquante
- Périmètre non unique → Erreur bloquante
- Moins de 3 FE valides → Erreur bloquante
- Plan Free → Erreur 403 (feature réservée Pro)

**Structure de réponse :**
```json
{
  "isValid": true,
  "statistics": {
    "sampleSize": 450,
    "median": 12.5,
    "q1": 8.2,
    "q3": 18.9,
    "min": 2.1,
    "max": 45.7,
    "mean": 14.3,
    "standardDeviation": 8.6,
    "iqr": 10.7,
    "percentRange": 2076.2,
    "top10": [...],
    "worst10": [...]
  },
  "chartData": [...], // 24 points pour le graphique
  "metadata": {
    "unit": "kg",
    "scope": "Cradle-to-gate",
    "sourcesCount": 3,
    "sources": ["ADEME", "Ecoinvent", "DEFRA"],
    "hasMultipleSources": true,
    "hasMultipleYears": false,
    "dateRange": { "min": 2022, "max": 2024 }
  }
}
```

---

### Nouvelle Table : `benchmarks`

**Objectif :** Sauvegarder les benchmarks générés pour historique et partage workspace

**Colonnes principales :**
- `id` (UUID, PK)
- `workspace_id` (référence workspace)
- `created_by` (référence user)
- `title` (titre du benchmark)
- `description` (optionnel)
- `search_query`, `search_filters`, `facet_filters` (paramètres originaux)
- `unit`, `scope`, `sample_size`, `sources`
- `statistics` (JSONB - toutes les stats calculées)
- `chart_data` (JSONB - 24 points pour régénération graphique)
- `top10`, `worst10` (JSONB)
- `metadata` (JSONB)
- `created_at`, `updated_at`
- `deleted_at` (soft delete)

**Sécurité RLS :**
- Utilisateurs d'un workspace peuvent voir tous les benchmarks du workspace
- Seul le créateur peut modifier/supprimer son benchmark
- Politique granulaire SELECT/INSERT/UPDATE

---

## 🎨 Frontend - Interface Utilisateur

### 1. Nouvelle Page : `/benchmark`

**Routes :**
- `/benchmark` : Génération nouveau benchmark (paramètres en query string)
- `/benchmark/:id` : Chargement benchmark sauvegardé

**Layout de la page :**
- `<UnifiedNavbar />` en haut (navbar commune de l'app)
- Container pleine largeur : `<div className="container mx-auto px-4 py-8 max-w-7xl">`
- **Structure identique aux pages `/settings` et `/import`** pour cohérence UX

**Structure de la page :**

#### Header
- Titre du benchmark (dynamique selon unité)
- Boutons d'action : Sauvegarder, Exporter, Partager
- Dropdown historique des benchmarks (icône History) : Accès rapide aux 50 derniers benchmarks sauvegardés du workspace

#### Alertes (si applicable)
- Warning jaune si sources multiples détectées
- Info bleue si années multiples détectées

#### Section 1 : Graphique principal
- **Type :** Bar chart avec 24 barres
- **Données :** Top 10 + Q1 + Médiane + Q3 + Worst 10
- **Gradient de couleur :** Vert (#4ABEA1) → Jaune → Rouge
- **Interactions :**
  - Tooltip détaillé au survol (nom, valeur, source, périmètre, année)
  - Click sur barre → Ouverture d'un modal avec détails complets du FE (nom, description, commentaires, méthodologie, type de données, contributeur)
- **Marqueurs visuels :** Lignes horizontales pour Q1, Médiane, Q3
- **Export :** Bouton intégré pour exporter le graphique en PNG

#### Section 2 : Statistiques détaillées
- **Layout :** Grid de cards responsive (desktop)
- **Card principale :** Médiane (mise en évidence avec border primary)
- **Autres cards :** Min, Max, Q1, Q3, Moyenne, Écart-type, Écart Min/Max, IQR
- **Design :** Charte graphique Ecodex (couleurs, fonts, shadows)
- **Tooltips d'aide :** Icône (?) sur chaque métrique avec explication contextuelle au survol

#### Section 3 : Tables Top 10 / Worst 10
- **Layout :** 2 tables côte à côte (grid 2 colonnes)
- **Colonnes :** Rang | Nom | Valeur FE | Source
- **Interactions :** Click sur ligne → Ouverture d'un modal avec détails complets du FE
- **Couleurs :** Vert pour Top 10, Rouge pour Worst 10

#### Section 4 : Métadonnées
- Unité et périmètre
- Taille de l'échantillon
- Sources utilisées (avec logos)
- Date de génération
- Warning/Info si nécessaire

---

### 2. Bouton déclencheur sur page `/search`

**Localisation :** Intégré dans la section des statistiques de recherche

**Apparence :**
- Bouton "Analyser / Benchmark" avec icône BarChart
- Badge "Pro" si plan Free (désactivé)
- Tooltip explicatif selon le contexte :
  - Si plan Free : "Fonctionnalité réservée au plan Pro"
  - Si 0 résultat : "Aucun résultat à analyser"
  - Si query vide : "Effectuez une recherche pour générer un benchmark"
  - Si OK : "Générer un benchmark statistique de ces X résultats"

**Comportements :**
- Désactivé si 0 résultat
- Désactivé si plan Free (+ tooltip "Réservé au plan Pro")
- Désactivé si aucune requête de recherche (query vide) : évite un benchmark sur toute la base sans filtre
- Au clic → Navigation vers `/benchmark` avec query params

---

### 3. Export PDF haute qualité

**Librairie recommandée :** `@react-pdf/renderer`

**Avantages vs html2canvas :**
- ✅ Qualité supérieure (texte natif, pas de rasterisation)
- ✅ Plus léger et rapide
- ✅ Multi-pages facile
- ✅ Charte graphique respectée

**Structure du PDF :**

**Page 1 : Vue d'ensemble**
- Header avec logo Ecodex
- Titre, date de génération, contexte (unité, périmètre)
- Statistiques clés (8 cards en grid)
- Footer avec mention "Généré par Ecodex"

**Page 2 : Top 10 et Worst 10**
- Table Top 10 complète
- Table Worst 10 complète
- Footer

**Format :** A4, Portrait, Couleurs Ecodex

---

### 4. Sauvegarde et partage

#### Sauvegarde
- Modal avec champs : Titre (requis) + Description (optionnel)
- Message : "Ce benchmark sera accessible par tous les membres de votre workspace"
- Enregistrement en DB avec toutes les données nécessaires
- Redirection automatique vers `/benchmark/:id` après sauvegarde

#### Partage
- Bouton "Partager" → Copie l'URL dans le presse-papier
- URL format : `/benchmark/:id` (si sauvegardé) ou `/benchmark?query=...&filters=...` (temporaire)
- Toast de confirmation : "Lien copié !"
- Tous les membres du workspace peuvent accéder aux benchmarks sauvegardés

#### Historique
- Dropdown dans le header de la page `/benchmark` (icône History)
- Affichage : Titre, Date, Taille échantillon, Unité
- Tri par date décroissante
- Limite : 50 derniers benchmarks du workspace
- Click sur un benchmark → Chargement de `/benchmark/:id`

---

## 🎨 Charte Graphique et Design

### Couleurs Ecodex (respectées partout)
- **Primary :** `#4B5DFF` (Bleu) - Médiane, titres, boutons
- **Accent :** `#4ABEA1` (Vert turquoise) - Top 10, valeurs basses
- **Secondary :** `#CEC3FF` (Lavande) - Backgrounds, borders
- **Destructive :** Rouge - Worst 10, valeurs hautes
- **Muted :** Gris - Textes secondaires

### Composants UI
- Utilisation exclusive des composants **shadcn/ui** existants
- Cards avec shadows Ecodex (`shadow-soft`, `shadow-premium`)
- Transitions smooth (`transition-smooth`)
- Typography : **Montserrat** (font principale)

### Responsive Desktop
- Breakpoints : md (768px), lg (1024px), xl (1280px)
- Grid adaptatif : 1 colonne → 2 colonnes → 4 colonnes
- Tables : Scroll horizontal si nécessaire
- Graphique : Responsive avec `ResponsiveContainer` de Recharts
- **Pas de support mobile** (desktop uniquement)
- **Pas de mode sombre** (mode clair uniquement)

---

## 🔒 Contrôle d'Accès et Sécurité

### Plan Pro uniquement
- **Frontend :** Guard sur la route `/benchmark` → Redirection vers page upgrade si plan Free
- **Backend :** Vérification dans l'Edge Function → Erreur 403 si plan Free
- **Bouton search :** Désactivé avec tooltip explicatif si plan Free

### Filtrage des données sensibles
- **Edge Function :** Vérification des assignations workspace via table `fe_source_workspace_assignments`
- Exclusion automatique des FE avec `variant='teaser'`
- Exclusion des sources paid (`access_level='paid'`) non assignées au workspace
- Aucune donnée sensible exposée au frontend

### RLS (Row Level Security)
- Table `benchmarks` : RLS activé
- Politiques granulaires par action (SELECT/INSERT/UPDATE)
- Soft delete avec `deleted_at` (pas de suppression physique)

---

## ⚡ Performance et Optimisations

### Économie de crédits Algolia
- **Validation facets-only** : 1 requête légère (hitsPerPage=0) pour vérifier unité/périmètre
- Si validation échoue → STOP (pas de requête complète)
- Si validation OK → 1 requête complète (hitsPerPage=1000)
- **Gain :** 50% de réduction de crédits en cas d'erreur de validation

### Limitation Algolia
- Maximum 1000 hits par requête (limite API Algolia)
- Suffisant pour une analyse statistique représentative
- Affichage de 24 points sur le graphique (optimisé pour lisibilité)

### Calculs statistiques
- Complexité O(n log n) pour le tri
- Calculs en mémoire côté Edge Function (rapide)
- Objectif : <2s pour 1000 FE

### Cache frontend
- **Stratégie :** Utiliser React Query pour mettre en cache les résultats de benchmark
- **Clé de cache :** Hash des paramètres (query + filters + facetFilters)
- **TTL (Time To Live) :** 5 minutes
- **Avantages :**
  - Si l'utilisateur retourne sur `/benchmark` avec les mêmes paramètres → Résultat instantané (pas de nouvelle requête Edge Function)
  - Navigation avant/arrière du navigateur → Pas de rechargement
  - Réduction de la charge serveur et des crédits Algolia
- **Invalidation :** Automatique après 5 minutes ou si l'utilisateur modifie sa recherche sur `/search`
- **Implémentation :** Hook `useQuery` de React Query avec `staleTime: 5 * 60 * 1000`

---

## 📋 Checklist d'Implémentation

### Phase 1 : Backend (8-10h)
- [ ] Créer la migration SQL pour table `benchmarks`
- [ ] Créer les types TypeScript partagés backend/frontend
- [ ] Implémenter l'Edge Function `generate-benchmark`
  - [ ] Validation facets-only (étape 1)
  - [ ] Requête full si validation OK (étape 2)
  - [ ] Filtrage sécurisé (teasers, assignations workspace)
  - [ ] Calculs statistiques complets
  - [ ] Détection warnings (sources/années multiples)
  - [ ] Gestion erreurs (auth, plan Pro, CORS)
- [ ] Tester avec Postman/curl
- [ ] Vérifier performances (<2s pour 1000 FE)

### Phase 2 : Frontend - Structure (4-6h)
- [ ] Créer la page `Benchmark.tsx` avec routes
- [ ] Créer les types TypeScript frontend
- [ ] Créer les hooks personnalisés (`useBenchmarkGeneration`, `useBenchmarkStorage`)
- [ ] Installer les dépendances (recharts, @react-pdf/renderer, file-saver)
- [ ] Mettre en place le routing dans `App.tsx`

### Phase 3 : Frontend - Composants (12-14h)
- [ ] `BenchmarkChart.tsx` : Graphique Recharts avec gradient et interactions
- [ ] `BenchmarkStatistics.tsx` : Grid de cards avec statistiques et tooltips d'aide
- [ ] `TopWorstTables.tsx` : 2 tables côte à côte
- [ ] `BenchmarkWarnings.tsx` : Alertes sources/années multiples
- [ ] `BenchmarkMetadata.tsx` : Infos contextuelles
- [ ] `BenchmarkHeader.tsx` : Titre, boutons d'action et dropdown historique
- [ ] `BenchmarkValidationError.tsx` : Affichage erreurs de validation
- [ ] `BenchmarkSkeleton.tsx` : États de chargement
- [ ] `BenchmarkItemModal.tsx` : Modal avec détails complets d'un FE

### Phase 4 : Export et Partage (6-8h)
- [ ] `BenchmarkExport.tsx` : Export PDF multi-pages + PNG graphique
- [ ] Template PDF avec charte Ecodex
- [ ] `BenchmarkSaveShare.tsx` : Modal sauvegarde + partage lien
- [ ] Intégration sauvegarde en DB
- [ ] Gestion historique des benchmarks

### Phase 5 : Intégration Search (2-3h)
- [ ] `BenchmarkTriggerButton.tsx` : Bouton avec guard Pro
- [ ] Intégration dans `SearchStats.tsx`
- [ ] Navigation avec query params
- [ ] Tooltips et états désactivés

### Phase 6 : Chargement Benchmarks Sauvegardés (3-4h)
- [ ] Flow `/benchmark/:id`
- [ ] Chargement depuis DB
- [ ] Affichage données sauvegardées
- [ ] Dropdown/Liste historique
- [ ] Option de régénération

### Phase 7 : Polish et UX (4-6h)
- [ ] Messages d'erreur localisés (FR/EN)
- [ ] Tooltips d'aide sur toutes les métriques statistiques
- [ ] Responsive desktop (breakpoints md/lg/xl)
- [ ] Accessibilité (ARIA labels, navigation clavier)
- [ ] Loading states et skeletons
- [ ] Animations de transition
- [ ] Tests manuels UX

### Phase 8 : Tests et Validation (6-8h)
- [ ] Tests E2E du flow complet
- [ ] Tests avec différents datasets
  - [ ] Petit échantillon (< 10 FE)
  - [ ] Échantillon moyen (~50 FE)
  - [ ] Grand échantillon (1000 FE)
  - [ ] Cas d'erreur (unité/périmètre non uniques)
  - [ ] Sources multiples (warning)
  - [ ] Années multiples (info)
- [ ] Tests de performance
  - [ ] Génération <2s pour 1000 FE
  - [ ] Export PDF <3s
  - [ ] Sauvegarde <1s
- [ ] Validation UX avec utilisateurs beta

### Phase 9 : Documentation (2-3h)
- [ ] Documentation technique pour développeurs
- [ ] Guide utilisateur avec screenshots
- [ ] Mise à jour README
- [ ] Changelog

---

## 📊 Estimation de Temps

### Total : 45-55 heures (4-5 jours intensifs)

**Détail par phase :**
- Backend : 8-10h
- Frontend Structure : 4-6h
- Frontend Composants : 12-14h
- Export/Partage : 6-8h
- Intégration Search : 2-3h
- Chargement Sauvegardés : 3-4h
- Polish + UX : 4-6h
- Tests + Validation : 6-8h
- Documentation : 2-3h

---

## 🚀 Extensions Futures (Post-MVP)

### Phase 2 - Nice-to-have
- [ ] Benchmarks pré-paramétrés (Aciers, Pantalons, Services Cloud, etc.)
- [ ] Comparaison de 2 benchmarks côte à côte
- [ ] Graphiques temporels (évolution sur plusieurs années)
- [ ] Export Excel (.xlsx) avec formules
- [ ] Commentaires collaboratifs sur benchmarks
- [ ] Notifications workspace (nouveau benchmark partagé)
- [ ] API publique pour intégrations tierces

---

## ✅ Points de Validation Architecture

### Cohérence avec codebase existante
✅ Réutilise les patterns existants (`algolia-search-proxy`, RLS, workspace)  
✅ Suit les conventions Edge Functions (auth, CORS, gestion erreurs)  
✅ Utilise shadcn/ui et charte graphique Ecodex  
✅ Types TypeScript partagés backend/frontend  
✅ Compatible avec l'architecture workspace multi-utilisateurs  

### Best practices Supabase
✅ RLS activé sur table `benchmarks`  
✅ Politiques granulaires par action  
✅ Soft delete avec `deleted_at`  
✅ Triggers `updated_at` automatiques  
✅ Index optimisés pour performance  
✅ Gestion erreurs dans Edge Function  

### Best practices Algolia
✅ Validation facets-only (économie crédits)  
✅ Limite 1000 hits (max API)  
✅ Filtrage sécurisé côté serveur  
✅ Pas de données sensibles exposées  

### Accessibilité et UX
✅ ARIA labels pour lecteurs d'écran  
✅ Navigation clavier complète  
✅ Responsive desktop (md/lg/xl)  
✅ Messages d'erreur clairs et localisés  
✅ Loading states et feedbacks utilisateur  
✅ Tooltips d'aide contextuels sur toutes les métriques statistiques  
✅ Modal avec détails complets des FE au click  

---

## 📦 Dépendances Techniques

### Nouvelles dépendances à installer
```bash
# Visualisation graphique
npm install recharts

# Export PDF haute qualité
npm install @react-pdf/renderer file-saver
npm install --save-dev @types/file-saver

# Utilitaires (vérifier si déjà présents)
npm install lucide-react
```

### Technologies utilisées
- **Backend :** Deno (Edge Functions), Supabase PostgreSQL
- **Frontend :** React, TypeScript, Recharts, shadcn/ui, Tailwind CSS
- **Export :** @react-pdf/renderer, file-saver
- **API :** Algolia Search API, Supabase RLS
- **Auth :** Supabase Auth (JWT)

---

## 🎯 KPIs et Métriques de Succès

### Métriques techniques
- Temps de génération < 2s pour 1000 FE
- Temps d'export PDF < 3s
- Taux d'erreur de validation < 5%
- Économie de crédits Algolia : ~50% sur validations échouées

### Métriques utilisateur
- Nombre de benchmarks générés / mois
- Nombre de benchmarks sauvegardés / mois
- Taux d'export PDF
- Taux de partage workspace
- Satisfaction utilisateurs (enquête post-utilisation)

### Métriques business
- Taux de conversion Free → Pro (feature comme argument de vente)
- Engagement utilisateurs Pro (utilisation régulière)
- Feedback qualitatif (retours utilisateurs)

---

## 🔄 Process de Validation

### Validation technique
1. Code review complète
2. Tests unitaires Edge Function
3. Tests E2E du flow complet
4. Tests de performance et charge
5. Audit de sécurité (RLS, filtrage données)

### Validation produit
1. Validation UX avec équipe design
2. Tests utilisateurs beta (3-5 utilisateurs Pro)
3. Validation conformité charte graphique
4. Validation accessibilité (WCAG niveau AA)
5. Validation documentation utilisateur

### Validation business
1. Validation positionnement pricing (feature Pro)
2. Validation messaging marketing
3. Validation documentation commerciale
4. Plan de communication aux clients

---

## 📅 Roadmap Proposée

### Sprint 1 (Semaine 1) - Backend + Structure
- Backend complet (Edge Function + Table)
- Structure frontend de base
- Tests techniques

### Sprint 2 (Semaine 2) - Frontend Core
- Composants principaux (graphique + stats)
- Intégration avec Edge Function
- Tests UX de base

### Sprint 3 (Semaine 3) - Export + Partage
- Export PDF/PNG
- Sauvegarde et partage
- Historique des benchmarks

### Sprint 4 (Semaine 4) - Polish + Launch
- Polish UX
- Tests complets
- Documentation
- Launch

---

## ❓ Risques et Mitigations

### Risques techniques
**Risque :** Performance dégradée avec 1000 FE  
**Mitigation :** Calculs optimisés O(n log n), tests de charge, cache frontend

**Risque :** Limites API Algolia  
**Mitigation :** Validation facets-only, documentation claire des limites

**Risque :** Export PDF complexe  
**Mitigation :** Utilisation @react-pdf/renderer (éprouvé), templates simples

### Risques UX
**Risque :** Validation bloquante frustrante pour utilisateurs  
**Mitigation :** Messages d'erreur clairs avec actions recommandées

**Risque :** Graphique illisible avec beaucoup de données  
**Mitigation :** Limitation à 24 points représentatifs, tooltips détaillés

### Risques business
**Risque :** Feature peu utilisée  
**Mitigation :** Communication proactive, onboarding intégré, exemples concrets

**Risque :** Coûts Algolia élevés  
**Mitigation :** Validation pré-requête, limite 1000 hits, monitoring usage

---

## 📞 Contact et Validation

Ce plan doit être validé par :
- ✅ Responsable Produit
- ✅ Équipe Technique (Lead Dev)
- ✅ Équipe Design/UX
- ✅ Responsable Business/Pricing

**Date de validation souhaitée :** [À compléter]  
**Date de début estimée :** [À compléter]  
**Date de livraison estimée :** [À compléter + 4-5 semaines]

---

*Document généré le [Date] - Version 1.0*

