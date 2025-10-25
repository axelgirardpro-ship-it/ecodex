// Hook optimisé pour les recherches Algolia
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Origin } from '@/lib/algolia/searchClient';
import { createUnifiedClient } from '@/lib/algolia/unifiedSearchClient';
import { smartRequestManager } from '@/lib/algolia/smartThrottling';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useEmissionFactorAccess } from '@/hooks/useEmissionFactorAccess';

export interface OptimizedSearchOptions {
  enableCache?: boolean;
  enableDebouncing?: boolean;
  enableThrottling?: boolean;
  priority?: number;
  debounceDelay?: number;
  maxResults?: number;
}

export interface SearchState {
  loading: boolean;
  results: Record<string, unknown>[];
  nbHits: number;
  error: string | null;
  lastQuery: string;
  searchTime: number;
}

export const useOptimizedSearch = (
  initialQuery: string = '',
  initialOrigin: Origin = 'all',
  options: OptimizedSearchOptions = {}
) => {
  const {
    enableCache = true,
    enableDebouncing = true,
    enableThrottling = true,
    priority = 2,
    debounceDelay,
    maxResults = 20
  } = options;

  const { currentWorkspace } = useWorkspace();
  const { assignedSources } = useEmissionFactorAccess();

  // État de la recherche
  const [searchState, setSearchState] = useState<SearchState>({
    loading: false,
    results: [],
    nbHits: 0,
    error: null,
    lastQuery: '',
    searchTime: 0
  });

  // États internes
  const [query, setQuery] = useState(initialQuery);
  const [origin, setOrigin] = useState<Origin>(initialOrigin);
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  
  // Refs pour la stabilité
  const clientRef = useRef<ReturnType<typeof createUnifiedClient> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchCountRef = useRef(0);

  // Créer le client unifié
  const unifiedClient = useMemo(() => {
    if (clientRef.current) {
      clientRef.current.dispose();
    }
    
    clientRef.current = createUnifiedClient(
      currentWorkspace?.id,
      assignedSources
    );
    
    return clientRef.current;
  }, [currentWorkspace?.id, assignedSources]);

  // Fonction de recherche optimisée
  const performSearch = useCallback(async (
    searchQuery: string,
    searchOrigin: Origin,
    searchFilters: Record<string, unknown> = {},
    isTyping = false
  ) => {
    // Annuler la recherche précédente
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Créer un nouveau controller
    abortControllerRef.current = new AbortController();
    const currentSearchId = ++searchCountRef.current;
    
    // Ne pas chercher si query vide
    if (!searchQuery.trim() && Object.keys(searchFilters).length === 0) {
      setSearchState(prev => ({
        ...prev,
        loading: false,
        results: [],
        nbHits: 0,
        lastQuery: searchQuery
      }));
      return;
    }

    const startTime = Date.now();
    
    setSearchState(prev => ({
      ...prev,
      loading: true,
      error: null
    }));

    try {
      const searchRequest = {
        params: {
          query: searchQuery,
          hitsPerPage: maxResults,
          page: 0,
          facetFilters: searchFilters.facetFilters || [],
          filters: searchFilters.filters,
          attributesToRetrieve: ['*'],
          ...searchFilters
        },
        origin: searchOrigin
      };

      const key = `${searchQuery}:${searchOrigin}:${JSON.stringify(searchFilters)}`;
      
      const result = await smartRequestManager.optimizedRequest(
        key,
        () => unifiedClient.search([searchRequest], {
          enableCache,
          enableDeduplication: true,
          enableBatching: !isTyping // Pas de batching pendant la frappe
        }),
        {
          debounce: enableDebouncing,
          throttle: enableThrottling,
          priority,
          context: {
            isTyping,
            hasFilters: Object.keys(searchFilters).length > 0
          }
        }
      );

      // Vérifier si cette recherche est toujours pertinente
      if (currentSearchId !== searchCountRef.current) {
        return; // Une recherche plus récente a été lancée
      }

      const searchTime = Date.now() - startTime;
      const searchResult = result.results?.[0] || { hits: [], nbHits: 0 };

      setSearchState({
        loading: false,
        results: searchResult.hits || [],
        nbHits: searchResult.nbHits || 0,
        error: null,
        lastQuery: searchQuery,
        searchTime
      });

    } catch (error: unknown) {
      // Ignorer les erreurs d'abort
      if (error.name === 'AbortError') return;
      
      // Vérifier si cette recherche est toujours pertinente
      if (currentSearchId !== searchCountRef.current) return;

      console.error('Search error:', error);
      setSearchState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Erreur de recherche',
        searchTime: Date.now() - startTime
      }));
    }
  }, [
    unifiedClient,
    enableCache,
    enableDebouncing,
    enableThrottling,
    priority,
    maxResults
  ]);

  // Effet pour déclencher la recherche
  useEffect(() => {
    const isTyping = searchState.loading; // Heuristique simple
    performSearch(query, origin, filters, isTyping);
  }, [query, origin, filters, performSearch]);

  // Fonction pour mettre à jour la requête
  const updateQuery = useCallback((newQuery: string) => {
    setQuery(newQuery);
  }, []);

  // Fonction pour mettre à jour l'origine
  const updateOrigin = useCallback((newOrigin: Origin) => {
    setOrigin(newOrigin);
  }, []);

  // Fonction pour mettre à jour les filtres
  const updateFilters = useCallback((newFilters: Record<string, unknown>) => {
    setFilters(newFilters);
  }, []);

  // Fonction pour recherche immédiate (sans debouncing)
  const searchImmediate = useCallback((
    searchQuery?: string,
    searchOrigin?: Origin,
    searchFilters?: Record<string, unknown>
  ) => {
    const finalQuery = searchQuery ?? query;
    const finalOrigin = searchOrigin ?? origin;
    const finalFilters = searchFilters ?? filters;
    
    // Forcer une recherche immédiate
    return smartRequestManager.optimizedRequest(
      `immediate:${finalQuery}:${finalOrigin}:${JSON.stringify(finalFilters)}`,
      () => unifiedClient.search([{
        params: {
          query: finalQuery,
          hitsPerPage: maxResults,
          page: 0,
          facetFilters: finalFilters.facetFilters || [],
          filters: finalFilters.filters,
          attributesToRetrieve: ['*'],
          ...finalFilters
        },
        origin: finalOrigin
      }], {
        enableCache,
        forceRefresh: true
      }),
      {
        debounce: false,
        throttle: enableThrottling,
        priority: 1 // Haute priorité
      }
    );
  }, [query, origin, filters, unifiedClient, enableCache, enableThrottling, maxResults]);

  // Fonction pour nettoyer le cache
  const clearCache = useCallback((source?: string, targetOrigin?: Origin) => {
    unifiedClient.invalidateCache(source, targetOrigin);
  }, [unifiedClient]);

  // Fonction pour obtenir les métriques
  const getMetrics = useCallback(() => {
    return {
      client: unifiedClient.getPerformanceMetrics(),
      requestManager: smartRequestManager.getStats()
    };
  }, [unifiedClient]);

  // Nettoyage à la destruction
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (clientRef.current) {
        clientRef.current.dispose();
      }
    };
  }, []);

  return {
    // État de la recherche
    ...searchState,
    
    // Paramètres actuels
    query,
    origin,
    filters,
    
    // Fonctions de mise à jour
    updateQuery,
    updateOrigin,
    updateFilters,
    
    // Fonctions utilitaires
    searchImmediate,
    clearCache,
    getMetrics,
    
    // Client pour usage avancé
    client: unifiedClient
  };
};

// Hook spécialisé pour les suggestions
export const useOptimizedSuggestions = (
  searchQuery: string,
  origin: Origin = 'all',
  maxSuggestions = 5
) => {
  const {
    results,
    loading,
    error,
    searchTime,
    client
  } = useOptimizedSearch(searchQuery, origin, {
    enableCache: true,
    enableDebouncing: true,
    enableThrottling: true,
    priority: 1, // Haute priorité pour les suggestions
    maxResults: maxSuggestions
  });

  // Transformer les résultats en suggestions
  const suggestions = useMemo(() => {
    return results.map((hit: Record<string, unknown>) => ({
      label: hit.Nom_fr || hit.Nom_en || hit.name || '',
      isPrivate: hit.scope === 'private',
      source: hit.Source,
      objectID: hit.objectID
    })).filter(s => s.label.length > 0);
  }, [results]);

  return {
    suggestions,
    loading,
    error,
    searchTime,
    client
  };
};

export default useOptimizedSearch;
