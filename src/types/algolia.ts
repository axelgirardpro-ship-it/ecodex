// ============================================
// IMPORTS FROM OFFICIAL ALGOLIA TYPES
// ============================================

// Réexporter les types officiels d'Algolia v5
export type {
  SearchResponse,
  SearchParams,
  SearchParamsObject,
  SearchMethodParams,
  Hit,
  FacetFilters,
  SearchForHits,
  SearchQuery,
  HighlightResult,
  SnippetResult,
  SearchHits,
  SearchStrategy
} from 'algoliasearch';

// ============================================
// TYPES ÉTENDUS SPÉCIFIQUES À L'APPLICATION
// ============================================

import type { Hit as AlgoliaBaseHit } from 'algoliasearch';

/**
 * Extension du type Hit d'Algolia avec nos champs spécifiques
 * pour les facteurs d'émission (Emission Factors)
 */
export interface EmissionFactorData {
  Source: string;
  Date?: number;
  FE?: number;
  Incertitude?: string;
  // Multi-langues
  Nom_fr?: string;
  Nom_en?: string;
  Description_fr?: string;
  Description_en?: string;
  Commentaires_fr?: string;
  Commentaires_en?: string;
  Secteur_fr?: string;
  Secteur_en?: string;
  'Sous-secteur_fr'?: string;
  'Sous-secteur_en'?: string;
  'Périmètre_fr'?: string;
  'Périmètre_en'?: string;
  Localisation_fr?: string;
  Localisation_en?: string;
  Unite_fr?: string;
  Unite_en?: string;
  // Compat: certains enregistrements historiques
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
}

/**
 * Type principal pour nos hits Algolia
 * Combine le Hit de base d'Algolia avec nos données métier
 */
export type AlgoliaHit = AlgoliaBaseHit<EmissionFactorData>;

// Note: Les types de base (SearchParams, SearchResponse, FacetFilters, etc.)
// sont importés depuis 'algoliasearch' ci-dessus

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
