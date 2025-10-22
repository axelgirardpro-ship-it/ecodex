# Feature Benchmark - Documentation Complète

**Date de création**: 22 octobre 2025  
**Version**: 1.0  
**Statut**: ✅ Production Ready

---

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Flux de données](#flux-de-données)
4. [Composants Frontend](#composants-frontend)
5. [Backend (Edge Function)](#backend-edge-function)
6. [Base de données](#base-de-données)
7. [Gestion des quotas](#gestion-des-quotas)
8. [Internationalisation](#internationalisation)
9. [Export et partage](#export-et-partage)
10. [Validation et erreurs](#validation-et-erreurs)
11. [Pour les agents IA](#pour-les-agents-ia)

---

## 📖 Vue d'ensemble

### Objectif

La feature Benchmark permet aux utilisateurs de générer des analyses statistiques comparatives de facteurs d'émission (FE) basées sur leurs recherches Algolia. Elle fournit :

- **Graphiques interactifs** : Distribution des FE avec quartiles (Q1, Médiane, Q3)
- **Statistiques** : Médiane, Q1, Q3, Min, Max, Moyenne, Écart-type, IQR, Étendue
- **Tables Top/Worst** : 10 meilleurs et 10 pires FE
- **Métadonnées** : Unité, périmètre, sources, période
- **Avertissements** : Sources multiples, années multiples, échantillon important
- **Historique** : Sauvegarde et consultation des benchmarks précédents
- **Export** : PNG pour partage rapide (PDF désactivé temporairement pour CSP)

### Accès

| Plan | Accès |
|------|-------|
| **Freemium (Trial)** | 3 benchmarks pendant la période d'essai |
| **Freemium (Expiré)** | ❌ Bloqué |
| **Pro** | ♾️ Illimité |

### Pages

1. **`/benchmark`** : Hub central listant tous les benchmarks sauvegardés (BenchmarkHub)
2. **`/benchmark/view`** : Affichage d'un benchmark généré ou sauvegardé (BenchmarkView)
3. **`/search`** : Bouton "Générer un benchmark" avec validation pré-navigation

---

## 🏗️ Architecture

### Stack Technique

- **Frontend**: React, TypeScript, TailwindCSS
- **Graphiques**: Recharts
- **Backend**: Supabase Edge Functions (Deno)
- **Base de données**: PostgreSQL (Supabase)
- **Search**: Algolia
- **State Management**: React Query (TanStack Query)
- **i18n**: react-i18next

### Diagramme de Flux

```
┌─────────────┐
│   /search   │  ◄─── Utilisateur effectue une recherche
└──────┬──────┘
       │
       │ Clic sur "Générer un benchmark"
       │
       ▼
┌─────────────────────────────────┐
│  useBenchmarkValidation (Sync)  │  ◄─── Validation côté client (Algolia facets)
│  - Vérification < 3 résultats   │
│  - Unités multiples ?           │
│  - Périmètres multiples ?       │
└──────┬──────────────────┬───────┘
       │                  │
       │ ✅ Valide       │ ❌ Invalide
       ▼                  ▼
  Navigation      BenchmarkValidationAlert
  /benchmark/view   (Alerte compacte sur /search)
       │
       ▼
┌─────────────────────────────────┐
│     useBenchmarkGeneration      │  ◄─── Hook React Query (frontend)
│  - Appel Edge Function          │
│  - Cache 5 min (TTL)            │
└──────┬──────────────────────────┘
       │
       ▼ POST /functions/v1/generate-benchmark
┌─────────────────────────────────┐
│    generate-benchmark (Deno)    │  ◄─── Edge Function
│  1. Authentification JWT        │
│  2. Vérification quota          │
│  3. Algolia facets (validation) │
│  4. Algolia hits (données)      │
│  5. Filtrage (sources payantes) │
│  6. Calculs statistiques        │
│  7. Sélection représentative    │
└──────┬──────────────────────────┘
       │
       ▼ Retour JSON
┌─────────────────────────────────┐
│      BenchmarkView Page         │
│  - Graphique (BenchmarkChart)   │
│  - Statistiques                 │
│  - Tables Top/Worst             │
│  - Actions (Save, Export, Share)│
└─────────────────────────────────┘
```

---

## 🔄 Flux de données

### 1. Génération d'un benchmark

**Étapes**:

1. **Utilisateur sur `/search`**
   - Effectue une recherche
   - Résultats Algolia affichés
   - Bouton "Générer un benchmark" visible

2. **Validation pré-navigation (Frontend)**
   - Hook `useBenchmarkValidation()` vérifie :
     - `nbHits >= 3` (minimum requis)
     - Une seule unité (ou filtre actif sur une unité)
     - Un seul périmètre (ou filtre actif sur un périmètre)
   - Si invalide : Affiche `BenchmarkValidationAlert` (alerte compacte)
   - Si valide : Navigation vers `/benchmark/view?query=...&filters=...`

3. **Génération (Backend)**
   - Hook `useBenchmarkGeneration()` appelle l'Edge Function
   - Edge Function :
     - Authentifie via JWT (`supabaseAuth.auth.getUser()`)
     - Récupère `workspace_id` et `plan_type`
     - Vérifie quotas (Freemium trial uniquement)
     - Appelle Algolia (2 requêtes) :
       1. **Facets-only** : Validation stricte (unité/périmètre uniques)
       2. **Full hits** : Récupération des FE (limite 1000)
     - Filtre les FE :
       - Exclut `variant:teaser` et `is_blurred:true` (Algolia filters)
       - Exclut sources payantes non assignées (post-fetch filter)
     - Calcule statistiques
     - Transforme les données pour le frontend
     - Incrémente `benchmarks_used` (Freemium seulement)

4. **Affichage (Frontend)**
   - `BenchmarkView` reçoit les données
   - Affiche tous les composants (graphique, stats, tables)
   - Permet de sauvegarder, exporter, partager

### 2. Sauvegarde d'un benchmark

**Étapes**:

1. Utilisateur clique "Sauvegarder" (`BenchmarkHeader`)
2. Modal `BenchmarkSaveModal` s'ouvre (titre + description)
3. Hook `useBenchmarkStorage().saveBenchmark()` :
   - Insert dans `benchmarks` table
   - Champs : `user_id`, `workspace_id`, `title`, `description`, `query_params`, `filters`, `statistics`, `chart_data`, `top10`, `worst10`, `metadata`
4. Succès : Toast + Redirection vers `/benchmark/view/:id`

### 3. Consultation de l'historique

**Étapes**:

1. Page `/benchmark` (BenchmarkHub) :
   - Affiche tous les benchmarks du workspace (RLS)
   - Grille de cards cliquables
2. Clic sur une card ou dropdown "Historique" :
   - Navigation vers `/benchmark/view/:id`
3. `BenchmarkView` avec `id` :
   - Hook `useBenchmarkStorage().useBenchmarkDetail(id)`
   - Récupère les données sauvegardées (pas de recalcul)
   - Affichage identique à un benchmark généré

---

## 🧩 Composants Frontend

### Pages

#### 1. `BenchmarkHub.tsx`

**Rôle**: Page centrale `/benchmark` listant tous les benchmarks sauvegardés du workspace.

**Features**:
- Grille de cards (3 colonnes sur desktop)
- Card affiche : Titre, date, description, badges (unité, périmètre, taille échantillon)
- Bouton "Nouveau Benchmark" → Redirige vers `/search`
- Bouton "Supprimer" (icône poubelle) sur chaque card
- État vide : Message + CTA "Créer un Benchmark"
- Skeleton loading pendant chargement

**Hooks utilisés**:
- `useBenchmarkStorage().history` : Liste des benchmarks (React Query)
- `useBenchmarkStorage().deleteBenchmark()` : Suppression
- `useTranslation('benchmark')` : i18n

#### 2. `BenchmarkView.tsx`

**Rôle**: Page `/benchmark/view` ou `/benchmark/view/:id` affichant un benchmark.

**Features**:
- Mode génération (query params) : Appelle Edge Function via `useBenchmarkGeneration()`
- Mode sauvegardé (ID) : Charge depuis DB via `useBenchmarkStorage().useBenchmarkDetail()`
- Gestion des états : Loading (skeleton), Error, Success
- Redirection vers `/benchmark` si ni ID ni query
- Intégration de tous les sous-composants

**Hooks utilisés**:
- `useBenchmarkGeneration()` : Génération via Edge Function
- `useBenchmarkStorage().useBenchmarkDetail()` : Chargement benchmark sauvegardé
- `useState<DisplayMode>(25)` : Sélection 25/50/100 points
- `useState<SortOrder>('asc')` : Tri ascendant/descendant
- `useMemo()` : Échantillonnage stratifié pour displayMode

**Échantillonnage**:
```typescript
// 25 points : Top 10 + Q1 + Médiane + Q3 + Worst 10
// 50 points : Échantillonnage stratifié (1 tous les n/50 FE)
// 100 points : Échantillonnage stratifié (1 tous les n/100 FE)
```

### Composants Benchmark

#### 1. `BenchmarkHeader.tsx`

**Rôle**: En-tête avec titre, actions, et sélecteur d'affichage.

**Actions**:
- **Sélecteur 25/50/100** : Change `displayMode` (visible si > 25 FE)
- **Toggle tri** : Ascendant ⇄ Descendant
- **Historique** : Dropdown avec les 50 derniers benchmarks
- **Sauvegarder** : Modal pour titre/description (si non sauvegardé)
- ~~**Exporter**~~ : Temporairement désactivé (CSP issues)
- **Partager** : Modal avec lien de partage workspace

**Props**:
```typescript
{
  title: string;
  displayMode: 25 | 50 | 100;
  onDisplayModeChange: (mode) => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (order) => void;
  benchmarkData: BenchmarkData;
  searchParams: { query, filters, facetFilters };
  savedBenchmarkId?: string;
  benchmarkContainerId?: string; // Pour export PNG
}
```

#### 2. `BenchmarkChart.tsx`

**Rôle**: Graphique de distribution (bar chart Recharts).

**Features**:
- **Barres colorées** : Dégradé vert (min) → jaune (médiane) → rouge (max)
- **Lignes de référence** : Q1 (pointillé bleu), Médiane (solide bleu épais), Q3 (pointillé violet)
- **Légende fixe** : En-tête avec valeurs Q1, Médiane, Q3
- **Tooltip** : Affiche nom complet (non tronqué), valeur, source, année, périmètre
- **Clic sur barre** : Ouvre modal `BenchmarkItemModal` avec tous les détails du FE
- **Zone cliquable étendue** : `minPointSize={15}` pour faciliter le clic sur petites valeurs
- **Labels tronqués** : Max 30 caractères sur l'axe X (avec `...`)
- **i18n** : Titre, légende, tooltip traduits

**Props**:
```typescript
{
  data: BenchmarkChartDataPoint[]; // Points à afficher (25/50/100)
  statistics: BenchmarkStatistics;
  displayMode: 25 | 50 | 100;
  totalCount: number; // Total des FE (avant échantillonnage)
  allData?: BenchmarkChartDataPoint[]; // Tous les FE (pour retrouver au clic)
}
```

#### 3. `BenchmarkStatistics.tsx`

**Rôle**: Grille de 9 cartes affichant les métriques statistiques.

**Métriques**:
1. **Médiane** : Valeur centrale (P50)
2. **Q1** : 1er quartile (P25)
3. **Q3** : 3ème quartile (P75)
4. **Min** : Valeur minimale
5. **Max** : Valeur maximale
6. **Moyenne** : Moyenne arithmétique
7. **Écart-type** : Dispersion autour de la moyenne
8. **IQR** : Écart interquartile (Q3 - Q1)
9. **Étendue (%)** : `((max - min) / min) * 100`

**Features**:
- Icône info (?) avec tooltip explicatif pour chaque métrique
- Valeurs formatées : 2-4 décimales selon métrique
- Couleur d'icône adaptée (bleu, vert, orange, violet)
- i18n : Labels + tooltips traduits

#### 4. `TopWorstTables.tsx`

**Rôle**: Deux tables côte à côte (Top 10 & Worst 10).

**Features**:
- Colonnes : #, Nom, Valeur, Source, Année
- Clic sur ligne : Ouvre `BenchmarkItemModal`
- Tri automatique : Top 10 (ascendant), Worst 10 (descendant)
- Badge pour le rank (#1, #2, ...)
- i18n : Titres + colonnes traduits

#### 5. `BenchmarkMetadata.tsx`

**Rôle**: Card affichant les infos contextuelles du benchmark.

**Informations**:
- **Requête** : Query Algolia utilisée
- **Unité** : Unité des FE (ex: "kg CO2e")
- **Périmètre** : Scope des FE (ex: "Scope 1")
- **Taille échantillon** : Nombre de FE analysés
- **Sources** : Liste des sources (ex: "ADEME, GLEC")
- **Période** : Range d'années (ex: "2018 - 2024")

#### 6. `BenchmarkWarnings.tsx`

**Rôle**: Affiche les avertissements si conditions détectées.

**Avertissements**:
1. **Sources multiples** : Méthodologies potentiellement différentes
2. **Années multiples** : Périodes différentes
3. **Échantillon important** : Risque de biais si données hétérogènes

**Format**: Alerte jaune avec icône ⚠️, message traduit avec interpolation (count, min, max).

#### 7. `BenchmarkItemModal.tsx`

**Rôle**: Modal détaillant un FE sélectionné (clic sur graphique ou table).

**Champs affichés**:
- Nom, Description, Valeur, Unité, Périmètre, Source, Année
- Localisation, Secteur, Sous-secteur, Commentaires
- Méthodologie, Type de données, Contributeur
- Bouton "Copier l'ID" (objectID)

#### 8. `BenchmarkSaveModal.tsx`

**Rôle**: Modal de sauvegarde avec formulaire.

**Champs**:
- **Titre** (requis) : Ex: "Benchmark transport routier 2024"
- **Description** (optionnel) : Texte libre
- Actions : Sauvegarder / Annuler

#### 9. `BenchmarkHistoryDropdown.tsx`

**Rôle**: Dropdown dans le header affichant les 50 derniers benchmarks.

**Features**:
- Liste scrollable avec date, titre, taille échantillon
- Clic → Navigation vers `/benchmark/view/:id`
- État vide : "Aucun benchmark sauvegardé"

#### 10. `BenchmarkShare.tsx`

**Rôle**: Bouton + modal pour partager le benchmark.

**Features**:
- Génère URL avec query params (si non sauvegardé) ou ID
- Bouton "Copier" pour le lien
- Message : "Accessible uniquement aux membres du workspace"

#### 11. `BenchmarkValidationAlert.tsx`

**Rôle**: Alerte compacte affichée sur `/search` en cas d'erreur de validation.

**Codes d'erreur**:
- `MULTIPLE_UNITS` : Plusieurs unités détectées
- `MULTIPLE_SCOPES` : Plusieurs périmètres détectés
- `NO_UNIT_OR_SCOPE` : Aucune unité/périmètre valide
- `INSUFFICIENT_DATA` : < 3 FE trouvés

**Format**: Alerte bleue (info) avec icône, titre court, message fusionné (description + action).

**Exemple**:
```
ℹ️ Précisez le périmètre
Votre recherche retourne 23 périmètres différents. Utilisez les filtres sur la gauche pour sélectionner un seul périmètre.
```

#### 12. `BenchmarkValidationError.tsx`

**Rôle**: Composant pleine page affiché sur `/benchmark/view` en cas d'erreur de génération.

**Features**:
- Card rouge avec icône AlertCircle
- Message d'erreur traduit
- Bouton "Retour à la recherche" → `/search`
- Détails techniques (collapsible)

#### 13. `BenchmarkSkeleton.tsx`

**Rôle**: Skeleton loader pendant la génération.

**Affiche**:
- Rectangles gris animés (`animate-pulse`)
- Simule le layout : Header, graphique, stats (3x3), tables

### Composant Search

#### `GenerateBenchmarkButton.tsx`

**Rôle**: Bouton dans `/search` pour déclencher la génération.

**Localisation**: Sous les stats de recherche (pas sur la même ligne).

**Features**:
- **Désactivé si** :
  - Query vide
  - 0 résultats
  - Plan Freemium ET quota dépassé
- **Tooltip** : Affiche la raison de désactivation
- **Validation** : Appelle `useBenchmarkValidation()` au clic
- **Affichage erreur** : `BenchmarkValidationAlert` sous le bouton si validation échoue
- **Navigation** : Si validation OK → `/benchmark/view?query=...`

**Props**: Aucune (utilise hooks Context + InstantSearch).

---

## ⚙️ Backend (Edge Function)

### `generate-benchmark/index.ts`

**URL**: `https://wrodvaatdujbpfpvrzge.supabase.co/functions/v1/generate-benchmark`

**Méthode**: `POST`

**Headers**:
- `Authorization: Bearer <JWT>`
- `Content-Type: application/json`

**Body**:
```typescript
{
  query: string;
  filters?: Record<string, any>; // Filtres Algolia refinementList
  facetFilters?: string[][]; // Filtres facet Algolia
  workspaceId: string;
  userId: string;
}
```

**Flux de traitement**:

1. **CORS Preflight** : Répond à `OPTIONS` avec headers CORS (`Access-Control-Allow-Origin: *`)

2. **Authentification** :
   ```typescript
   const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
   ```
   - **Important** : Déployé avec `--no-verify-jwt` car JWT manuel (pas `verify_jwt: true`)
   - Si erreur : 401 Unauthorized

3. **Récupération Workspace & Plan** :
   ```typescript
   const { data: workspace } = await supabaseAdmin
     .from('workspaces')
     .select('plan_type')
     .eq('id', workspaceId)
     .single();
   ```

4. **Vérification Quota (Freemium Trial uniquement)** :
   ```typescript
   if (workspace.plan_type === 'freemium') {
     // Vérifier workspace_trials.expires_at
     // Vérifier search_quotas.benchmarks_used < benchmarks_limit
   }
   ```
   - Pro : Pas de vérification (illimité)
   - Si quota dépassé ou trial expiré : 403 Forbidden

5. **Algolia Query 1 : Facets-Only (Validation)** :
   ```typescript
   const validateResponse = await fetch(`${ALGOLIA_URL}/1/indexes/${INDEX_NAME}/query`, {
     method: 'POST',
     headers: {
       'X-Algolia-Application-Id': ALGOLIA_APP_ID,
       'X-Algolia-API-Key': ALGOLIA_API_KEY,
       'Content-Type': 'application/json',
     },
     body: JSON.stringify({
       query,
       facets: ['Unite_fr', 'Périmètre_fr'],
       maxValuesPerFacet: 1000,
       hitsPerPage: 0,
       facetFilters: baseFacetFilters,
       filters: 'NOT variant:teaser AND NOT is_blurred:true',
     }),
   });
   ```
   - Vérifie strictement : 1 unité ET 1 périmètre
   - Si validation échoue : 400 Bad Request avec code d'erreur

6. **Algolia Query 2 : Full Hits (Récupération)** :
   ```typescript
   const algoliaResponse = await fetch(`${ALGOLIA_URL}/1/indexes/${INDEX_NAME}/query`, {
     method: 'POST',
     body: JSON.stringify({
       query,
       hitsPerPage: 1000,
       facetFilters: baseFacetFilters,
       filters: 'NOT variant:teaser AND NOT is_blurred:true',
       attributesToRetrieve: [
         'objectID', 'Nom_fr', 'FE', 'Unite_fr', 'Périmètre_fr',
         'Source', 'Date', 'Publication', 'Localisation_fr',
         'Secteur_fr', 'Sous-secteur_fr', 'Description_fr',
         'Commentaires_fr', 'Méthodologie', 'Type_de_données',
         'Contributeur', 'access_level'
       ],
     }),
   });
   ```

7. **Filtrage des Sources Payantes** :
   ```typescript
   const validHits = algoliaHits.filter((hit: any) => {
     // Exclure sources payantes non assignées au workspace
     if (hit.access_level === 'paid' && !assignedSources.includes(hit.Source)) {
       return false;
     }
     return true;
   });
   ```

8. **Vérification < 3 FE** :
   ```typescript
   if (validHits.length < 3) {
     return jsonResponse(400, {
       error: 'Données insuffisantes',
       code: 'INSUFFICIENT_DATA',
       details: { count: validHits.length },
     });
   }
   ```

9. **Calculs Statistiques** :
   ```typescript
   const sorted = validHits.map(h => h.FE).sort((a, b) => a - b);
   const statistics = {
     sampleSize: sorted.length,
     min: sorted[0],
     max: sorted[sorted.length - 1],
     mean: sorted.reduce((a, b) => a + b, 0) / sorted.length,
     median: sorted[Math.floor(sorted.length / 2)],
     q1: sorted[Math.floor(sorted.length * 0.25)],
     q3: sorted[Math.floor(sorted.length * 0.75)],
     stdDev: calculateStdDev(sorted),
     iqr: q3 - q1,
     percentRange: ((max - min) / min) * 100,
   };
   ```

10. **Transformation des Données** :
    ```typescript
    const transformHit = (hit) => ({
      objectID: hit.objectID || hit.id || '',
      Nom_fr: hit.Nom_fr || hit.Name || '',
      FE: hit.FE,
      Unite_fr: hit.Unite_fr,
      Périmètre_fr: hit.Périmètre_fr,
      Source: hit.Source,
      Date: hit.Date || hit.Publication || null,
      // ... tous les champs
    });

    const transformChartData = (hit) => ({
      objectID: hit.objectID,
      name: hit.Nom_fr, // camelCase pour le frontend
      fe: hit.FE,
      unit: hit.Unite_fr,
      scope: hit.Périmètre_fr,
      source: hit.Source,
      date: hit.Date || hit.Publication,
      // ...
    });
    ```

11. **Sélection Top10 / Worst10** :
    ```typescript
    const sorted = [...validHits].sort((a, b) => a.FE - b.FE);
    const top10 = sorted.slice(0, 10).map(transformHit);
    const worst10 = sorted.slice(-10).reverse().map(transformHit);
    ```

12. **Détection des Avertissements** :
    ```typescript
    const sources = [...new Set(validHits.map(h => h.Source))];
    const years = [...new Set(validHits.map(h => h.Publication).filter(Boolean))];
    const hasMultipleSources = sources.length > 1;
    const hasMultipleYears = years.length > 1;
    const hasLargeSample = validHits.length > 500;
    ```

13. **Incrémentation Quota (Freemium uniquement)** :
    ```typescript
    if (workspace.plan_type === 'freemium') {
      await supabaseAdmin
        .from('search_quotas')
        .update({ benchmarks_used: quotaData.benchmarks_used + 1 })
        .eq('workspace_id', workspaceId);
    }
    ```

14. **Retour JSON** :
    ```typescript
    return jsonResponse(200, {
      statistics,
      chartData, // TOUS les points (pas de sélection côté backend)
      top10,
      worst10,
      metadata: {
        query,
        unit: units[0],
        scope: scopes[0],
        sourcesCount: sources.length,
        sources,
        hasMultipleSources,
        hasMultipleYears,
        hasLargeSample,
        dateRange: { min, max },
      },
      warnings: [...], // Messages traduits générés par le frontend
    });
    ```

**Déploiement**:
```bash
SUPABASE_ACCESS_TOKEN="sbp_..." supabase functions deploy generate-benchmark \
  --project-ref wrodvaatdujbpfpvrzge \
  --no-verify-jwt
```

**Variables d'environnement** (Secrets Supabase) :
- `ALGOLIA_APP_ID`
- `ALGOLIA_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## 🗄️ Base de données

### Table `benchmarks`

**Rôle**: Stocker les benchmarks sauvegardés par les utilisateurs.

**Schéma**:
```sql
CREATE TABLE public.benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  query_params JSONB NOT NULL, -- { query, filters, facetFilters }
  statistics JSONB NOT NULL, -- BenchmarkStatistics
  chart_data JSONB NOT NULL, -- BenchmarkChartDataPoint[]
  top10 JSONB NOT NULL, -- BenchmarkEmissionFactor[]
  worst10 JSONB NOT NULL, -- BenchmarkEmissionFactor[]
  metadata JSONB NOT NULL, -- BenchmarkMetadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_benchmarks_workspace ON public.benchmarks(workspace_id, deleted_at);
CREATE INDEX idx_benchmarks_user ON public.benchmarks(user_id, deleted_at);
```

**RLS Policies**:
```sql
-- Lecture : Tous les membres du workspace
CREATE POLICY "Workspace members can view benchmarks"
ON public.benchmarks FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
  )
  AND deleted_at IS NULL
);

-- Création : Membres du workspace
CREATE POLICY "Workspace members can create benchmarks"
ON public.benchmarks FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
  )
);

-- Modification : Tous les membres du workspace (pas juste le créateur)
CREATE POLICY "Workspace members can update benchmarks"
ON public.benchmarks FOR UPDATE
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
  )
);

-- Suppression : Tous les membres du workspace
CREATE POLICY "Workspace members can delete benchmarks"
ON public.benchmarks FOR DELETE
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_users WHERE user_id = auth.uid()
  )
);
```

**Migration**: `20251022092500_create_benchmarks_table.sql`

### Table `search_quotas` (Extension)

**Rôle**: Gérer les quotas de benchmarks pour les utilisateurs Freemium.

**Colonnes ajoutées**:
```sql
ALTER TABLE public.search_quotas
ADD COLUMN IF NOT EXISTS benchmarks_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS benchmarks_limit INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS benchmarks_reset_date TIMESTAMPTZ;

COMMENT ON COLUMN public.search_quotas.benchmarks_used IS 'Nombre de benchmarks générés pendant le trial (Freemium) ou total (Pro)';
COMMENT ON COLUMN public.search_quotas.benchmarks_limit IS 'Limite de benchmarks : 3 pour Freemium (trial), 999 pour Pro';
COMMENT ON COLUMN public.search_quotas.benchmarks_reset_date IS 'Date de reset du quota benchmarks (= trial.expires_at pour Freemium)';
```

**Logique**:
- **Freemium** : `benchmarks_limit = 3`, `benchmarks_reset_date = workspace_trials.expires_at`
- **Pro** : Pas de limite (ou `benchmarks_limit = 999`)
- Vérification côté Edge Function : `benchmarks_used < benchmarks_limit` ET `NOW() < benchmarks_reset_date`

**Migration**: `20251022092459_add_benchmarks_to_quotas.sql`

### Table `workspace_trials`

**Rôle**: Détermine si un workspace Freemium est en période d'essai.

**Champs utilisés**:
- `workspace_id`
- `expires_at` : Date d'expiration du trial
- `trial_type` : 'standard' ou autre

**Logique**:
```sql
SELECT expires_at FROM workspace_trials WHERE workspace_id = ? AND expires_at > NOW()
```

---

## 📊 Gestion des quotas

### Logique Freemium

**Conditions d'accès**:
1. **Plan Pro** : ♾️ Illimité (pas de vérification)
2. **Plan Freemium (Trial actif)** : 3 benchmarks max
   - Vérification : `workspace_trials.expires_at > NOW()`
   - Compteur : `search_quotas.benchmarks_used < 3`
3. **Plan Freemium (Trial expiré)** : ❌ Bloqué
   - Message : "Votre période d'essai a expiré. Passez au plan Pro."

### Incrémentation

**Où** : Edge Function `generate-benchmark`, après génération réussie.

**Code**:
```typescript
if (workspace.plan_type === 'freemium') {
  const { data: quotaData } = await supabaseAdmin
    .from('search_quotas')
    .select('benchmarks_used, benchmarks_limit, benchmarks_reset_date')
    .eq('workspace_id', workspaceId)
    .single();

  // Vérifier quota AVANT génération
  if (quotaData.benchmarks_used >= quotaData.benchmarks_limit) {
    return jsonResponse(403, { error: 'Quota exceeded', code: 'QUOTA_EXCEEDED' });
  }

  // Vérifier expiration trial
  if (new Date() > new Date(quotaData.benchmarks_reset_date)) {
    return jsonResponse(403, { error: 'Trial expired', code: 'TRIAL_EXPIRED' });
  }

  // Incrémenter APRÈS génération
  await supabaseAdmin
    .from('search_quotas')
    .update({ benchmarks_used: quotaData.benchmarks_used + 1 })
    .eq('workspace_id', workspaceId);
}
```

### Affichage Frontend

**Widget Quota** (`NavbarQuotaWidget.tsx`) :
- Affiche "Benchmarks : X/3" pour Freemium en trial
- Affiche "Benchmarks : Illimité ♾️" pour Pro
- Tooltip : Détails du quota + lien upgrade

**Hook `useQuotas`** :
- Extension pour inclure `benchmarks_used`, `benchmarks_limit`, `benchmarks_reset_date`
- Calcul `canGenerateBenchmark` :
  ```typescript
  const canGenerateBenchmark = useMemo(() => {
    if (currentWorkspace?.plan_type === 'pro') return true;
    if (!quotaData) return false;
    const isTrialActive = quotaData.benchmarks_reset_date && new Date() < new Date(quotaData.benchmarks_reset_date);
    return isTrialActive && quotaData.benchmarks_used < quotaData.benchmarks_limit;
  }, [quotaData, currentWorkspace]);
  ```

---

## 🌍 Internationalisation

### Fichiers de traduction

#### `src/locales/fr/benchmark.json`

**Sections**:
- `page` : Titre/sous-titre de la page
- `hub` : Textes du BenchmarkHub (vide, nouveau, titre)
- `header` : Actions du header (save, share, history, display modes)
- `chart` : Graphique (titre, légende, tooltip, warning)
- `statistics` : Labels + tooltips des 9 métriques
- `tables` : Top/Worst tables (titres, colonnes)
- `metadata` : Infos benchmark (query, unit, scope, sources, period)
- `warnings` : Messages d'avertissement (sources multiples, années, échantillon)
- `modal` : Modal détails FE (champs, actions)
- `skeleton` : Loading
- `errors` : Erreurs de génération/validation
- `save` : Modal de sauvegarde
- `history` : Dropdown historique
- `export` : PNG/PDF (désactivé)
- `share` : Modal de partage

#### `src/locales/en/benchmark.json`

**Structure identique**, traductions en anglais.

### Composants traduits

**Hook utilisé** : `useTranslation('benchmark')`

**Exemples** :
```typescript
// Titre
const { t } = useTranslation('benchmark');
<h1>{t('page.title', 'Benchmark')}</h1>

// Avec interpolation
<p>{t('header.sample_size', { count: 42, defaultValue: '{{count}} emission factors analyzed' })}</p>

// Pluriel
<span>{t('metadata.sources', 'Source')}</span>
<span>{t('metadata.sources_plural', 'Sources')}</span>
```

### Navbar

**Ajout dans `navbar.json`** :
```json
{
  "benchmark": "Benchmark" // FR et EN identiques
}
```

**UnifiedNavbar.tsx** :
```typescript
<Link to={buildLocalizedPath('/benchmark', language)}>
  <BarChart3 className="h-5 w-5" />
  {t('navbar:benchmark')}
</Link>
```

---

## 📤 Export et partage

### Export PNG (Actif)

**Composant**: `BenchmarkExportPNG.tsx`

**Bibliothèque**: `html2canvas`

**Fonctionnement**:
1. Capture du conteneur `#benchmark-content` (graphique + stats + tables)
2. Conversion en canvas via `html2canvas(element, { scale: 2 })`
3. Export en PNG via `canvas.toBlob()`
4. Téléchargement via `file-saver`

**Limitations CSP** : Nécessite `img-src data: blob:` dans CSP (actuellement en place).

**Bouton** : Temporairement commenté dans `BenchmarkHeader` (dropdown "Exporter").

### Export PDF (Désactivé)

**Raison** : Problème CSP avec `@react-pdf/renderer`.

**Erreur** :
```
Refused to load the script 'blob:...' because it violates the CSP directive "script-src 'self'".
```

**Composant** : `BenchmarkExportPDF.tsx` (créé mais non utilisé)

**Solutions futures** :
1. **Côté client** : Modifier CSP Vercel pour ajouter `script-src 'unsafe-eval' blob:` (risque sécurité)
2. **Côté serveur** : Générer PDF via Edge Function avec `jsPDF` ou équivalent
3. **Service externe** : API de génération PDF (Cloudflare Workers, AWS Lambda)

**Décision actuelle** : Désactivé, export PNG uniquement.

### Partage (Actif)

**Composant**: `BenchmarkShare.tsx`

**Fonctionnement**:
1. Génère URL du benchmark :
   - Si sauvegardé : `/benchmark/view/:id`
   - Si non sauvegardé : `/benchmark/view?query=...&filters=...`
2. Modal avec champ input + bouton "Copier"
3. Copie via `navigator.clipboard.writeText(url)`
4. Message : "Accessible uniquement aux membres du workspace"

**Sécurité** : RLS Supabase garantit que seuls les membres du workspace peuvent accéder au benchmark (via ID ou régénération).

---

## ❌ Validation et erreurs

### Validation Pré-Navigation (Frontend)

**Hook**: `useBenchmarkValidation()`

**Checks** :
1. **Nombre de résultats** : `results.nbHits >= 3`
2. **Unité unique** : 1 seule unité dans les facets Algolia (sauf si filtre actif)
3. **Périmètre unique** : 1 seul périmètre dans les facets (sauf si filtre actif)

**Codes d'erreur** :
- `INSUFFICIENT_DATA` : < 3 résultats
- `MULTIPLE_UNITS` : Plusieurs unités détectées
- `MULTIPLE_SCOPES` : Plusieurs périmètres détectés
- `NO_UNIT_OR_SCOPE` : Aucune unité/périmètre valide
- `UNKNOWN` : Erreur inconnue

**Affichage** : `BenchmarkValidationAlert` sur `/search` (alerte compacte).

### Validation Backend (Edge Function)

**Checks** :
1. **Authentification** : JWT valide
2. **Quota** : `benchmarks_used < benchmarks_limit` (Freemium)
3. **Trial actif** : `NOW() < workspace_trials.expires_at` (Freemium)
4. **Algolia facets** : Strictement 1 unité ET 1 périmètre
5. **Données suffisantes** : `validHits.length >= 3` (après filtrage sources payantes)

**Codes d'erreur HTTP** :
- `401` : Unauthorized (JWT invalide)
- `403` : Forbidden (quota dépassé, trial expiré)
- `400` : Bad Request (validation échouée, données insuffisantes)
- `500` : Internal Server Error

**Affichage** : `BenchmarkValidationError` sur `/benchmark/view` (page pleine avec bouton retour).

### Gestion des Erreurs

**Frontend** (`BenchmarkView.tsx`) :
```typescript
const { data, isLoading, error } = useBenchmarkGeneration(...);

if (isLoading) return <BenchmarkSkeleton />;
if (error) return <BenchmarkValidationError error={error} />;
if (data) return <BenchmarkContent />;
```

**Messages traduits** (`errors` dans `benchmark.json`) :
- `generation_failed` : Échec générique
- `trial_expired` : Trial expiré
- `quota_exceeded` : Quota dépassé
- `no_results` : Aucun résultat
- `no_query` : Query manquante
- `back_to_search` : Bouton retour

---

## 🤖 Pour les agents IA

### Résumé Conceptuel

La feature Benchmark est un **système de génération et de gestion d'analyses statistiques** de facteurs d'émission basé sur les résultats Algolia. Elle se compose de :

1. **Frontend React** : Pages, composants, hooks (React Query)
2. **Backend Deno** : Edge Function pour calculs + validation
3. **Base de données PostgreSQL** : Stockage benchmarks + quotas
4. **Algolia** : Source de données (FE)

### Points Clés pour Modifications Futures

#### 1. Ajout d'une nouvelle métrique statistique

**Fichiers à modifier** :
1. **Backend** : `supabase/functions/generate-benchmark/index.ts`
   - Ajouter le calcul dans la section "Calculs statistiques"
   - Ajouter le champ dans l'objet `statistics` retourné
2. **Type** : `src/types/benchmark.ts` → `BenchmarkStatistics`
3. **Composant** : `src/components/benchmark/BenchmarkStatistics.tsx`
   - Ajouter une nouvelle card avec label + tooltip
4. **i18n** : `src/locales/fr/benchmark.json` et `en/benchmark.json`
   - Section `statistics` : `new_metric.label` et `new_metric.tooltip`

#### 2. Modification du graphique

**Fichier** : `src/components/benchmark/BenchmarkChart.tsx`

**Exemples** :
- **Changer couleurs** : Fonction `getBarColor()`
- **Ajouter ligne de référence** : `<ReferenceLine y={value} stroke="..." />`
- **Modifier légende** : Section avec `border-t-2`, `bg-...`, `border-...`
- **Tooltip** : Composant `CustomTooltip`

#### 3. Ajout d'un filtre de validation

**Hook** : `src/hooks/useBenchmarkValidation.ts`

**Logique** :
```typescript
// Ajouter une condition dans validateBenchmark()
if (/* nouvelle condition */) {
  return {
    valid: false,
    error: {
      code: 'NEW_ERROR_CODE',
      message: 'Message FR/EN',
      details: { ... },
    },
  };
}
```

**Affichage** : `src/components/benchmark/BenchmarkValidationAlert.tsx`
- Ajouter un `case 'NEW_ERROR_CODE'` dans `getAlertConfig()`

#### 4. Modification des quotas

**Fichiers** :
1. **Migration** : Nouvelle migration SQL pour modifier `search_quotas`
2. **Edge Function** : `supabase/functions/generate-benchmark/index.ts`
   - Section "Vérification Quota"
3. **Hook** : `src/hooks/useQuotas.ts`
   - Mise à jour de `canGenerateBenchmark`
4. **Widget** : `src/components/ui/NavbarQuotaWidget.tsx`

#### 5. Ajout d'un type d'export

**Étapes** :
1. Créer composant `BenchmarkExport<Format>.tsx`
2. Ajouter dans `BenchmarkHeader.tsx` (dropdown "Exporter")
3. Tester les problèmes CSP (si client-side)
4. Ajouter traductions dans `benchmark.json` → `export.<format>`

### Patterns de Code

#### Hook React Query

**Exemple** (`useBenchmarkGeneration.ts`) :
```typescript
export const useBenchmarkGeneration = (query: string, filters, facetFilters, options) => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.benchmark.generate(hash),
    queryFn: async () => {
      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, filters, facetFilters, workspaceId, userId }),
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    enabled: options?.enabled && !!user && !!query,
    staleTime: 5 * 60 * 1000, // Cache 5 min
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });

  return { data, isLoading, error, refetch };
};
```

#### Échantillonnage Stratifié

**Exemple** (`BenchmarkView.tsx`) :
```typescript
const displayedChartData = useMemo(() => {
  if (!benchmarkData?.chartData) return [];
  
  const sortedData = [...benchmarkData.chartData].sort((a, b) => 
    sortOrder === 'asc' ? a.fe - b.fe : b.fe - a.fe
  );
  const n = sortedData.length;

  if (displayMode === 100 && n > 100) {
    // Échantillonnage stratifié : 1 tous les n/100
    const selected = [];
    const step = n / 100;
    for (let i = 0; i < 100; i++) {
      selected.push(sortedData[Math.floor(i * step)]);
    }
    return selected;
  }

  return sortedData.slice(0, displayMode);
}, [benchmarkData, displayMode, sortOrder]);
```

#### Transformation Algolia → Frontend

**Exemple** (Edge Function) :
```typescript
const transformChartData = (hit: any) => ({
  objectID: hit.objectID || hit.id || '',
  name: hit.Nom_fr || hit.Name || '', // PascalCase → camelCase
  fe: hit.FE,
  unit: hit.Unite_fr,
  scope: hit.Périmètre_fr,
  source: hit.Source,
  date: hit.Date || hit.Publication || null, // Fallback sur Publication
  localisation: hit.Localisation_fr || '',
  sector: hit.Secteur_fr || '',
});
```

### Dépendances Importantes

**Frontend** :
- `recharts` : Graphiques
- `react-query` : State management asynchrone
- `react-i18next` : i18n
- `react-instantsearch` : Algolia hooks
- `file-saver` : Export PNG
- `html2canvas` : Capture screenshot
- `date-fns` : Formatage dates

**Backend** :
- `@supabase/supabase-js` : Client Supabase
- `fetch` : Appels Algolia (pas de SDK car Deno)

### Tests à Effectuer

**Scénarios** :
1. ✅ Génération benchmark avec 1 unité + 1 périmètre (Pro)
2. ✅ Génération benchmark avec unités multiples → Alerte
3. ✅ Génération benchmark avec < 3 FE → Alerte
4. ✅ Génération benchmark Freemium (trial actif, quota non dépassé)
5. ✅ Génération benchmark Freemium (quota dépassé) → Erreur 403
6. ✅ Génération benchmark Freemium (trial expiré) → Erreur 403
7. ✅ Sauvegarde benchmark → Insert DB
8. ✅ Consultation benchmark sauvegardé → Lecture DB
9. ✅ Suppression benchmark → Soft delete (deleted_at)
10. ✅ Historique → Dropdown avec 50 derniers
11. ✅ Partage → Copie lien workspace-only
12. ✅ Export PNG → Téléchargement fichier
13. ✅ i18n → Switch FR/EN change tous les textes
14. ✅ Clic sur barre graphique → Modal détails FE
15. ✅ Clic sur ligne table → Modal détails FE
16. ✅ Sélecteur 25/50/100 points → Échantillonnage correct
17. ✅ Toggle tri asc/desc → Graphique inversé
18. ✅ Sources payantes non assignées → Filtrées (pas dans benchmark)
19. ✅ FE teaser/blurred → Exclus via Algolia filters

### Erreurs Connues et Solutions

#### 1. **JWT Authentication Failed (Edge Function)**

**Symptôme** : 401 Unauthorized lors de l'appel à l'Edge Function.

**Cause** : Edge Function déployée avec `--verify-jwt` mais authentification manuelle via `supabaseAuth.auth.getUser()`.

**Solution** : Déployer avec `--no-verify-jwt` :
```bash
supabase functions deploy generate-benchmark --no-verify-jwt
```

**Documentation** : `docs/hotfix/2025-10-20-fix-edge-function-jwt-auth.md`

**Principe** :
- `--verify-jwt` : Supabase vérifie automatiquement le JWT et injecte `x-sb-user` header
- `--no-verify-jwt` : Pas de vérification auto, on fait manuellement avec `auth.getUser(token)`

**Code à utiliser** :
```typescript
// ✅ Avec --no-verify-jwt
let userId: string | null = null;
if (authHeader) {
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
  if (!error && user) {
    userId = user.id;
  }
}
```

**À NE PAS faire** :
```typescript
// ❌ Avec --verify-jwt (ne fonctionne pas si déployé avec --no-verify-jwt)
const userHeader = req.headers.get('x-sb-user');
const user = userHeader ? JSON.parse(userHeader) : null;
```

#### 2. **CORS Issues**

**Symptôme** : `Access-Control-Allow-Origin` errors.

**Solution** : Edge Function retourne headers CORS :
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Preflight
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: corsHeaders });
}

// Toutes les réponses
return new Response(JSON.stringify(data), { headers: corsHeaders });
```

**Note** : Pas de `Access-Control-Allow-Credentials: true` avec `Origin: *` (conflit).

#### 3. **CSP Issues (PDF/PNG Export)**

**Symptôme** :
```
Refused to load script 'blob:...' because it violates CSP directive "script-src 'self'".
```

**Cause** : `@react-pdf/renderer` génère des workers en blob URLs (non autorisé par CSP).

**Solutions** :
1. **Court terme** : Désactiver export PDF, garder PNG seulement
2. **Moyen terme** : Générer PDF côté serveur (Edge Function avec `jsPDF`)
3. **Long terme** : Modifier CSP Vercel pour autoriser `script-src blob:` (risque sécurité)

**CSP actuel** (Vercel) :
```
script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net
img-src 'self' data: blob: https:
```

#### 4. **Double Encoding Query Params**

**Symptôme** : `query` apparaît comme `%2522transport%2522` au lieu de `"transport"`.

**Cause** : `URLSearchParams.set()` encode automatiquement, ne pas utiliser `encodeURIComponent()`.

**Solution** :
```typescript
// ✅ Bon
searchParams.set('query', query);

// ❌ Mauvais
searchParams.set('query', encodeURIComponent(query));
```

#### 5. **React "Cannot update component while rendering"**

**Symptôme** : Warning React lors de la redirection dans `BenchmarkView`.

**Cause** : `navigate()` appelé directement dans le render.

**Solution** : Utiliser `useEffect` :
```typescript
React.useEffect(() => {
  if (!id && !searchParams.query) {
    navigate('/benchmark');
  }
}, [id, searchParams.query, navigate]);
```

---

## 📚 Ressources Complémentaires

### Documentation Produit

- `PLAN_BENCHMARK_FEATURE.md` : Plan exhaustif de la feature (specs produit)
- `BENCHMARK_COMPONENTS_STATUS.md` : Status d'implémentation des composants
- `IMPLEMENTATION_COMPLETE.md` : Rapport de fin d'implémentation

### Documentation Technique

- `docs/features/paid-source-locks.md` : Filtrage des sources payantes
- `docs/hotfix/2025-10-20-fix-edge-function-jwt-auth.md` : Fix JWT authentication
- `docs/architecture/search-security.md` : Sécurité recherche Algolia

### Migrations SQL

- `supabase/migrations/20251022092459_add_benchmarks_to_quotas.sql`
- `supabase/migrations/20251022092500_create_benchmarks_table.sql`
- `supabase/migrations/20251022100000_fix_benchmarks_rls.sql`

### Types TypeScript

- `src/types/benchmark.ts` : Toutes les interfaces (BenchmarkData, Statistics, etc.)

---

## ✅ Checklist de Compréhension (Pour Agents IA)

Avant de modifier la feature Benchmark, assurez-vous de comprendre :

- [ ] Le flux de données de bout en bout (Search → Validation → Edge Function → Affichage)
- [ ] La distinction entre validation frontend (sync) et backend (async)
- [ ] Le système de quotas Freemium vs Pro
- [ ] La RLS Supabase pour les benchmarks (workspace-based, pas user-based)
- [ ] L'échantillonnage stratifié pour 50/100 points
- [ ] La transformation des données Algolia (PascalCase/snake_case → camelCase)
- [ ] Le filtrage des sources payantes (Algolia filters + post-fetch filter)
- [ ] L'authentification JWT avec `--no-verify-jwt`
- [ ] La structure des traductions i18n (namespace `benchmark`)
- [ ] Les limitations CSP pour export PDF

---

**Dernière mise à jour** : 22 octobre 2025  
**Auteur** : Développement avec Claude Sonnet 4.5  
**Version** : 1.0 (Production)

