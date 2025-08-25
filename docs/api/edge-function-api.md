# API Edge Function - algolia-search-proxy

## Vue d'ensemble

La Edge Function `algolia-search-proxy` centralise toutes les requêtes de recherche Algolia avec une architecture unifiée, sécurisée et optimisée.

**Endpoint** : `https://[project-ref].supabase.co/functions/v1/algolia-search-proxy`

## Authentification

### Méthode

Toutes les requêtes doivent inclure un token JWT Supabase valide :

```http
Authorization: Bearer <supabase_jwt_token>
```

### Validation

La fonction vérifie automatiquement :
- ✅ Validité du token JWT
- ✅ Existence de l'utilisateur
- ✅ Permissions workspace
- ✅ Sources assignées

## Interface de requête

### Format de requête unifiée

```typescript
interface UnifiedSearchRequest {
  origin: 'public' | 'private';           // Origine de la recherche
  params: {
    query?: string;                       // Terme de recherche
    hitsPerPage?: number;                 // Nombre de résultats (défaut: 20)
    page?: number;                        // Page (défaut: 0)
    facetFilters?: string[][];            // Filtres Algolia
    filters?: string;                     // Filtres numériques
    attributesToHighlight?: string[];     // Champs à surligner
    highlightPreTag?: string;             // Balise de début de surlignage
    highlightPostTag?: string;            // Balise de fin de surlignage
    getRankingInfo?: boolean;             // Informations de ranking
    analytics?: boolean;                  // Analytics Algolia
    clickAnalytics?: boolean;             // Analytics de clic
    // ... autres paramètres Algolia supportés
  };
}
```

### Exemple de requête

```javascript
const searchRequest = {
  origin: 'public',
  params: {
    query: 'électricité',
    hitsPerPage: 10,
    page: 0,
    facetFilters: [
      ['Secteur_fr:Énergie']
    ],
    attributesToHighlight: ['Nom_fr', 'Description_fr']
  }
};

const response = await fetch('/functions/v1/algolia-search-proxy', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(searchRequest)
});
```

## Logique de traitement

### 1. Authentification et permissions

```typescript
interface UserPermissions {
  userId: string;                         // ID utilisateur Supabase
  workspaceId?: string;                   // ID workspace (si membre)
  assignedSources: string[];              // Sources premium assignées
}
```

### 2. Construction de la requête Algolia

#### Origine 'public'

```typescript
// Utilisateur avec sources premium assignées
const facetFilters = [
  ['variant:full', 'is_blurred:true'],    // Accès complet + teasers
  ['Source:assigned_source_1', 'Source:assigned_source_2', 'is_blurred:true']
];
const attributesToRetrieve = undefined;   // Tous les attributs

// Utilisateur sans sources premium
const facetFilters = [
  ['variant:full', 'is_blurred:true'],    // Standards + teasers
  ['access_level:standard', 'is_blurred:true']
];
const attributesToRetrieve = [           // Attributs limités
  'objectID', 'Source', 'Nom_fr', 'Secteur_fr', 'is_blurred', 'variant'
  // PAS de FE, Description, Commentaires
];
```

#### Origine 'private'

```typescript
// Membre d'un workspace
const facetFilters = [
  ['scope:private'],
  [`workspace_id:${workspaceId}`]
];
const attributesToRetrieve = undefined;   // Accès complet

// Non-membre
// Aucun résultat retourné
```

### 3. Post-traitement sécurisé

```typescript
const postProcessSecurely = (response: AlgoliaResponse, permissions: UserPermissions) => {
  return {
    ...response,
    hits: response.hits.map(hit => {
      // Détection des teasers premium
      const isTeaser = hit.access_level === 'premium' && 
                      hit.is_blurred && 
                      !permissions.assignedSources.includes(hit.Source);

      if (isTeaser) {
        return {
          ...hit,
          _isTeaser: true,        // Métadonnée UI
          _upgradeRequired: true  // Indication mise à niveau
        };
      }

      return hit;
    })
  };
};
```

## Format de réponse

### Structure de réponse

```typescript
interface UnifiedSearchResponse {
  hits: AlgoliaHit[];                     // Résultats de recherche
  nbHits: number;                         // Nombre total de résultats
  page: number;                           // Page actuelle
  nbPages: number;                        // Nombre total de pages
  hitsPerPage: number;                    // Résultats par page
  exhaustiveNbHits: boolean;              // Comptage exhaustif
  query: string;                          // Requête effectuée
  params: string;                         // Paramètres utilisés
  processingTimeMS: number;               // Temps de traitement Algolia
  // ... autres métadonnées Algolia
}
```

### Structure d'un hit

```typescript
interface AlgoliaHit {
  objectID: string;                       // ID unique
  scope: 'public' | 'private';            // Portée
  access_level: 'standard' | 'premium';   // Niveau d'accès
  Source: string;                         // Source des données
  
  // Champs toujours disponibles
  Nom_fr: string;
  Nom_en?: string;
  Secteur_fr: string;
  Secteur_en?: string;
  Date?: string;
  
  // Champs conditionnels (selon permissions)
  FE?: number;                            // Facteur d'émission
  Description_fr?: string;                // Description française
  Description_en?: string;                // Description anglaise
  Commentaires_fr?: string;               // Commentaires français
  Commentaires_en?: string;               // Commentaires anglais
  Incertitude?: number;                   // Incertitude
  
  // Métadonnées de sécurité (ajoutées par post-traitement)
  _isTeaser?: boolean;                    // Indique un teaser
  _upgradeRequired?: boolean;             // Mise à niveau requise
  
  // Métadonnées Algolia
  _highlightResult?: any;                 // Résultats de surlignage
  _rankingInfo?: any;                     // Informations de ranking
}
```

## Gestion des erreurs

### Codes d'erreur

| Code | Description | Action |
|------|-------------|--------|
| `400` | Requête malformée | Vérifier le format JSON |
| `401` | Non authentifié | Fournir un token valide |
| `403` | Non autorisé | Vérifier les permissions |
| `429` | Trop de requêtes | Implémenter un rate limiting |
| `500` | Erreur serveur | Réessayer ou contacter le support |

### Format d'erreur

```typescript
interface ErrorResponse {
  error: {
    code: string;                         // Code d'erreur
    message: string;                      // Message d'erreur
    details?: any;                        // Détails supplémentaires
  };
  timestamp: string;                      // Horodatage
  requestId: string;                      // ID de la requête pour le debug
}
```

### Exemples d'erreurs

```json
// Token manquant
{
  "error": {
    "code": "MISSING_AUTH_TOKEN",
    "message": "Token d'authentification requis"
  },
  "timestamp": "2025-01-12T10:30:00Z",
  "requestId": "req_abc123"
}

// Origine invalide
{
  "error": {
    "code": "INVALID_ORIGIN",
    "message": "L'origine doit être 'public' ou 'private'"
  },
  "timestamp": "2025-01-12T10:30:00Z",
  "requestId": "req_def456"
}
```

## Performance et limites

### Limites de requête

| Paramètre | Limite | Recommandation |
|-----------|--------|----------------|
| `hitsPerPage` | 1000 | 20-50 pour l'UI |
| `query` | 512 caractères | Requêtes concises |
| `facetFilters` | 100 filtres | Grouper logiquement |
| Timeout | 30 secondes | Optimiser les requêtes |

### Optimisations

```typescript
// ✅ Bonne pratique : Requête optimisée
{
  origin: 'public',
  params: {
    query: 'électricité',
    hitsPerPage: 20,
    attributesToHighlight: ['Nom_fr'],
    analytics: false  // Désactiver si non nécessaire
  }
}

// ❌ Éviter : Requête non-optimisée
{
  origin: 'public',
  params: {
    query: 'électricité',
    hitsPerPage: 1000,  // Trop élevé
    attributesToHighlight: ['*'],  // Trop large
    getRankingInfo: true  // Coûteux si non utilisé
  }
}
```

## Monitoring et debugging

### Headers de réponse

```http
X-Processing-Time-MS: 150
X-Algolia-Query-ID: abc123def456
X-Request-ID: req_789xyz
X-Cache-Hit: false
```

### Logs disponibles

```javascript
// Via Supabase CLI ou Dashboard
supabase functions logs algolia-search-proxy --follow

// Exemple de log
{
  "level": "info",
  "timestamp": "2025-01-12T10:30:00Z",
  "message": "Search request processed",
  "data": {
    "userId": "user_123",
    "origin": "public",
    "query": "électricité",
    "hits": 42,
    "processingTimeMS": 150
  }
}
```

## Exemples d'intégration

### React avec InstantSearch

```typescript
import { createProxyClient } from '@/lib/algolia/proxySearchClient';

const searchClient = createProxyClient('unified');

// Utilisation avec InstantSearch
<InstantSearch searchClient={searchClient} indexName="emission_factors_fr">
  <SearchBox />
  <Hits />
</InstantSearch>
```

### Requête directe

```typescript
const searchDirectly = async (query: string, origin: 'public' | 'private') => {
  const response = await fetch('/functions/v1/algolia-search-proxy', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      origin,
      params: { query, hitsPerPage: 10 }
    })
  });

  if (!response.ok) {
    throw new Error(`Search failed: ${response.statusText}`);
  }

  return response.json();
};
```

## Migration depuis l'ancienne API

### Changements requis

```typescript
// AVANT : Requêtes multiples
const publicResults = await searchClient.search([{
  indexName: 'emission_factors_fr',
  params: { query: 'électricité' }
}]);

// APRÈS : Requête unifiée
const results = await unifiedClient.search([{
  indexName: 'emission_factors_fr',
  params: { query: 'électricité' },
  origin: 'public'  // Nouveau paramètre requis
}]);
```

### Compatibilité

- ✅ **Paramètres Algolia** : Tous supportés
- ✅ **Format de réponse** : Compatible
- ✅ **InstantSearch** : Fonctionne sans modification
- ⚠️ **Nouveaux champs** : `_isTeaser`, `_upgradeRequired`

---

**Version API** : 1.0  
**Dernière mise à jour** : Janvier 2025  
**Support** : Équipe technique DataCarb
