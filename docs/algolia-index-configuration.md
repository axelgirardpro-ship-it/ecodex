# Configuration Algolia - Index `ef_all`

## 📋 Vue d'ensemble

Ce document liste la configuration complète de l'index Algolia `ef_all` pour le projet Ecodex.

---

## 🔍 Searchable Attributes (Attributs de recherche)

Les attributs de recherche déterminent dans quels champs Algolia effectue la recherche textuelle.

### Configuration par langue

**Français (par défaut):**
```json
[
  "Nom_fr",
  "Description_fr", 
  "Commentaires_fr"
]
```

**Anglais:**
```json
[
  "Nom_en",
  "Description_en",
  "Commentaires_en"
]
```

### Dans l'interface Algolia Dashboard

Allez dans **Configuration → Searchable attributes** et ajoutez:

```
unordered(Nom_fr)
unordered(Nom_en)
unordered(Description_fr)
unordered(Description_en)
unordered(Commentaires_fr)
unordered(Commentaires_en)
```

> **Note**: Le modificateur `unordered()` garantit que la position du match dans l'attribut n'affecte pas le ranking.

---

## 🏷️ Facets (Attributs pour les filtres)

Les facettes permettent de filtrer les résultats. Tous les attributs utilisés dans les filtres doivent être déclarés comme facettes.

### Configuration complète

Dans **Configuration → Facets**, ajoutez ces attributs:

```json
[
  "scope",
  "access_level",
  "workspace_id",
  "assigned_workspace_ids",
  "Source",
  "Date",
  "Type_de_données",
  "Type_de_données_en",
  "Unite_fr",
  "Unite_en",
  "Localisation_fr",
  "Localisation_en",
  "Périmètre_fr",
  "Périmètre_en",
  "Secteur_fr",
  "Secteur_en",
  "Sous-secteur_fr",
  "Sous-secteur_en",
  "variant",
  "is_blurred"
]
```

### Description des facettes principales

| Facette | Type | Description |
|---------|------|-------------|
| `scope` | string | `public` ou `private` - détermine la base (commune ou personnelle) |
| `access_level` | string | `standard` ou `premium` - niveau d'accès requis |
| `workspace_id` | string (UUID) | ID du workspace propriétaire (pour base privée) |
| `assigned_workspace_ids` | array | Liste des workspaces ayant accès aux sources premium |
| `Source` | string | Nom de la source de données (ex: "Base Empreinte", "ADEME") |
| `Date` | number | Année de référence des données |
| `Unite_fr` / `Unite_en` | string | Unité de mesure (ex: "kg CO2e") |
| `Localisation_fr` / `Localisation_en` | string | Localisation géographique |
| `Périmètre_fr` / `Périmètre_en` | string | Périmètre d'application |
| `Secteur_fr` / `Secteur_en` | string | Secteur d'activité |
| `Sous-secteur_fr` / `Sous-secteur_en` | string | Sous-secteur d'activité |
| `Type_de_données` / `Type_de_données_en` | string | Type de données |
| `variant` | string | `full` ou `teaser` - type de variant pour le blur |
| `is_blurred` | boolean | Indique si les données sensibles sont masquées |

---

## 🎯 Attributes to Retrieve (Attributs retournés)

Les attributs qui doivent être retournés dans les résultats de recherche.

### Configuration

Dans **Configuration → Attributes to retrieve**, ajoutez:

```json
[
  "objectID",
  "object_id",
  "scope",
  "access_level",
  "workspace_id",
  "assigned_workspace_ids",
  "is_blurred",
  "variant",
  "FE",
  "Source",
  "Date",
  "Incertitude",
  "Contributeur",
  "Contributeur_en",
  "Méthodologie",
  "Méthodologie_en",
  "Type_de_données",
  "Type_de_données_en",
  "ID_FE",
  "Nom_fr",
  "Description_fr",
  "Commentaires_fr",
  "Unite_fr",
  "Localisation_fr",
  "Périmètre_fr",
  "Secteur_fr",
  "Sous-secteur_fr",
  "Nom_en",
  "Description_en",
  "Commentaires_en",
  "Unite_en",
  "Localisation_en",
  "Périmètre_en",
  "Secteur_en",
  "Sous-secteur_en",
  "localization_score",
  "perimeter_score",
  "base_score",
  "unit_score"
]
```

---

## 🎨 Attributes to Highlight (Surlignage)

Les attributs où les correspondances de recherche seront surlignées.

### Configuration

Dans **Configuration → Attributes to highlight**, ajoutez:

```json
[
  "Nom_fr",
  "Description_fr",
  "Commentaires_fr",
  "Nom_en",
  "Description_en",
  "Commentaires_en"
]
```

---

## 📊 Ranking & Relevance

### Custom Ranking (optionnel)

Pour améliorer la pertinence, vous pouvez configurer un ranking personnalisé:

Dans **Configuration → Ranking and Sorting → Custom ranking**, ajoutez:

```json
[
  "desc(Date)",
  "asc(Source)"
]
```

Cela privilégie:
1. Les données les plus récentes (Date décroissante)
2. L'ordre alphabétique des sources

### Distinct (déduplication)

Si vous utilisez plusieurs variants (teaser/full), configurez:

**Attribute for Distinct**: `group_id` ou `objectID`

---

## ⚙️ Advanced Settings

### Index Settings (Paramètres recommandés)

```json
{
  "attributesForFaceting": [
    "searchable(scope)",
    "searchable(access_level)",
    "filterOnly(workspace_id)",
    "filterOnly(assigned_workspace_ids)",
    "searchable(Source)",
    "searchable(Date)",
    "searchable(Type_de_données)",
    "searchable(Type_de_données_en)",
    "searchable(Unite_fr)",
    "searchable(Unite_en)",
    "searchable(Localisation_fr)",
    "searchable(Localisation_en)",
    "searchable(Périmètre_fr)",
    "searchable(Périmètre_en)",
    "searchable(Secteur_fr)",
    "searchable(Secteur_en)",
    "searchable(Sous-secteur_fr)",
    "searchable(Sous-secteur_en)",
    "searchable(variant)",
    "searchable(is_blurred)"
  ],
  "searchableAttributes": [
    "unordered(Nom_fr)",
    "unordered(Nom_en)",
    "unordered(Description_fr)",
    "unordered(Description_en)",
    "unordered(Commentaires_fr)",
    "unordered(Commentaires_en)"
  ],
  "attributesToRetrieve": [
    "objectID",
    "object_id",
    "scope",
    "access_level",
    "workspace_id",
    "assigned_workspace_ids",
    "is_blurred",
    "variant",
    "FE",
    "Source",
    "Date",
    "Incertitude",
    "Contributeur",
    "Contributeur_en",
    "Méthodologie",
    "Méthodologie_en",
    "Type_de_données",
    "Type_de_données_en",
    "ID_FE",
    "Nom_fr",
    "Description_fr",
    "Commentaires_fr",
    "Unite_fr",
    "Localisation_fr",
    "Périmètre_fr",
    "Secteur_fr",
    "Sous-secteur_fr",
    "Nom_en",
    "Description_en",
    "Commentaires_en",
    "Unite_en",
    "Localisation_en",
    "Périmètre_en",
    "Secteur_en",
    "Sous-secteur_en",
    "localization_score",
    "perimeter_score",
    "base_score",
    "unit_score"
  ],
  "attributesToHighlight": [
    "Nom_fr",
    "Description_fr",
    "Commentaires_fr",
    "Nom_en",
    "Description_en",
    "Commentaires_en"
  ],
  "customRanking": [
    "desc(Date)",
    "asc(Source)"
  ],
  "hitsPerPage": 20,
  "maxValuesPerFacet": 500,
  "minWordSizefor1Typo": 4,
  "minWordSizefor2Typos": 8,
  "typoTolerance": true,
  "allowTyposOnNumericTokens": false,
  "queryType": "prefixLast",
  "removeWordsIfNoResults": "lastWords"
}
```

---

## 🚀 Application via API (Script de configuration)

Si vous préférez appliquer la configuration via l'API Algolia, voici un script Node.js:

```javascript
const algoliasearch = require('algoliasearch');

const client = algoliasearch('YOUR_APP_ID', 'YOUR_ADMIN_API_KEY');
const index = client.initIndex('ef_all');

const settings = {
  attributesForFaceting: [
    'searchable(scope)',
    'searchable(access_level)',
    'filterOnly(workspace_id)',
    'filterOnly(assigned_workspace_ids)',
    'searchable(Source)',
    'searchable(Date)',
    'searchable(Type_de_données)',
    'searchable(Type_de_données_en)',
    'searchable(Unite_fr)',
    'searchable(Unite_en)',
    'searchable(Localisation_fr)',
    'searchable(Localisation_en)',
    'searchable(Périmètre_fr)',
    'searchable(Périmètre_en)',
    'searchable(Secteur_fr)',
    'searchable(Secteur_en)',
    'searchable(Sous-secteur_fr)',
    'searchable(Sous-secteur_en)',
    'searchable(variant)',
    'searchable(is_blurred)'
  ],
  searchableAttributes: [
    'unordered(Nom_fr)',
    'unordered(Nom_en)',
    'unordered(Description_fr)',
    'unordered(Description_en)',
    'unordered(Commentaires_fr)',
    'unordered(Commentaires_en)'
  ],
  attributesToRetrieve: [
    'objectID', 'object_id', 'scope', 'access_level', 'workspace_id',
    'assigned_workspace_ids', 'is_blurred', 'variant', 'FE', 'Source',
    'Date', 'Incertitude', 'Contributeur', 'Contributeur_en',
    'Méthodologie', 'Méthodologie_en', 'Type_de_données', 'Type_de_données_en',
    'ID_FE', 'Nom_fr', 'Description_fr', 'Commentaires_fr', 'Unite_fr',
    'Localisation_fr', 'Périmètre_fr', 'Secteur_fr', 'Sous-secteur_fr',
    'Nom_en', 'Description_en', 'Commentaires_en', 'Unite_en',
    'Localisation_en', 'Périmètre_en', 'Secteur_en', 'Sous-secteur_en',
    'localization_score', 'perimeter_score', 'base_score', 'unit_score'
  ],
  attributesToHighlight: [
    'Nom_fr', 'Description_fr', 'Commentaires_fr',
    'Nom_en', 'Description_en', 'Commentaires_en'
  ],
  customRanking: ['desc(Date)', 'asc(Source)'],
  hitsPerPage: 20,
  maxValuesPerFacet: 500,
  typoTolerance: true,
  queryType: 'prefixLast',
  removeWordsIfNoResults: 'lastWords'
};

index.setSettings(settings)
  .then(() => console.log('✅ Configuration Algolia appliquée avec succès'))
  .catch(err => console.error('❌ Erreur:', err));
```

---

## 🧪 Vérification

Après avoir appliqué la configuration, vérifiez que tout fonctionne:

1. **Dashboard Algolia** → Index `ef_all` → Configuration
2. Vérifiez chaque section (Searchable, Facets, etc.)
3. Testez une recherche dans l'onglet "Browse"
4. Assurez-vous que les filtres fonctionnent (scope, Source, etc.)

---

## 📝 Notes importantes

- **`scope`**: CRITIQUE - doit être en facette pour filtrer public/private
- **`workspace_id`**: CRITIQUE - doit être en facette pour la base personnelle
- **`assigned_workspace_ids`**: Pour les sources premium assignées
- **Tous les attributs de filtre** doivent être déclarés comme facettes
- **Les attributs searchable** sont limités aux champs de nom/description/commentaires pour de meilleures performances

---

## 📅 Dernière mise à jour

Date: 16 octobre 2025  
Version: 115 (Edge Function)

