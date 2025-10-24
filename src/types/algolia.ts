// ============================================
// ALGOLIA HIT - Facteur d'émission
// ============================================

export interface AlgoliaHighlightResult {
  value: string;
  matchLevel: 'none' | 'partial' | 'full';
  matchedWords: string[];
  fullyHighlighted?: boolean;
}

export interface AlgoliaHighlightResultRecord {
  [key: string]: AlgoliaHighlightResult | AlgoliaHighlightResultRecord;
}

export interface AlgoliaHit {
  objectID: string;
  Source: string;
  Date?: number;
  FE?: number;
  Incertitude?: string;
  // Multi-langues
  Nom_fr?: string; Nom_en?: string;
  Description_fr?: string; Description_en?: string;
  Commentaires_fr?: string; Commentaires_en?: string;
  Secteur_fr?: string; Secteur_en?: string;
  'Sous-secteur_fr'?: string; 'Sous-secteur_en'?: string;
  'Périmètre_fr'?: string; 'Périmètre_en'?: string;
  Localisation_fr?: string; Localisation_en?: string;
  Unite_fr?: string; Unite_en?: string;
  // Compat: certains enregistrements historiques peuvent garder l'ancien nom FR
  "Unité donnée d'activité"?: string;
  // Legacy non localisés (compat)
  Nom?: string;
  Description?: string;
  Commentaires?: string;
  Contributeur?: string;
  Contributeur_en?: string;
  Méthodologie?: string;
  Méthodologie_en?: string;
  'Type_de_données'?: string;
  'Type_de_données_en'?: string;
  // Facets/meta
  workspace_id?: string;
  import_type?: string;
  dataset_name?: string;
  access_level?: 'public' | 'premium' | 'paid';
  __indexName?: string;
  // Server-side processing
  is_blurred?: boolean;
  // Highlight results
  _highlightResult?: AlgoliaHighlightResultRecord;
}

// ============================================
// ALGOLIA SEARCH PARAMS
// ============================================

export type AlgoliaFacetFilter = string | string[];
export type AlgoliaFacetFilters = (AlgoliaFacetFilter | AlgoliaFacetFilter[])[];

export interface AlgoliaSearchParams {
  query?: string;
  filters?: string;
  facetFilters?: AlgoliaFacetFilters;
  facets?: string[];
  attributesToRetrieve?: string[];
  attributesToHighlight?: string[];
  attributesToSnippet?: string[];
  hitsPerPage?: number;
  page?: number;
  offset?: number;
  length?: number;
  getRankingInfo?: boolean;
  analytics?: boolean;
  analyticsTags?: string[];
  clickAnalytics?: boolean;
  userToken?: string;
}

// ============================================
// ALGOLIA SEARCH RESPONSE
// ============================================

export interface AlgoliaFacetStats {
  min: number;
  max: number;
  avg: number;
  sum: number;
}

export interface AlgoliaFacets {
  [facetName: string]: {
    [facetValue: string]: number;
  };
}

export interface AlgoliaFacetStatsRecord {
  [facetName: string]: AlgoliaFacetStats;
}

export interface AlgoliaSearchResponse<T = AlgoliaHit> {
  hits: T[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
  exhaustiveNbHits: boolean;
  exhaustiveFacetsCount: boolean;
  exhaustiveTypo: boolean;
  processingTimeMS: number;
  query: string;
  params?: string;
  index?: string;
  facets?: AlgoliaFacets;
  facets_stats?: AlgoliaFacetStatsRecord;
  queryID?: string;
  serverTimeMS?: number;
}

// ============================================
// ALGOLIA CLIENT TYPES
// ============================================

export interface AlgoliaSearchOptions {
  cacheable?: boolean;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface AlgoliaMultipleQueriesOptions {
  strategy?: 'none' | 'stopIfEnoughMatches';
}

export interface AlgoliaIndexQuery {
  indexName: string;
  params?: AlgoliaSearchParams;
  query?: string;
}

export interface AlgoliaMultipleQueriesResponse {
  results: AlgoliaSearchResponse[];
}

// ============================================
// CACHE & REQUEST TYPES
// ============================================

export interface AlgoliaCacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

export interface AlgoliaRequestKey {
  method: string;
  path: string;
  data?: unknown;
}

export interface AlgoliaPendingRequest<T = unknown> {
  promise: Promise<T>;
  timestamp: number;
}
