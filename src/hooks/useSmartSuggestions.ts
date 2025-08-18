// Hook optimisé pour les suggestions intelligentes
import { useState, useEffect, useRef, useCallback } from 'react';
import { smartSuggestionManager, SuggestionItem } from '@/lib/algolia/smartSuggestions';
import { Origin } from '@/lib/algolia/searchClient';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useEmissionFactorAccess } from '@/hooks/useEmissionFactorAccess';
import { useSearchHistory } from '@/hooks/useSearchHistory';

export interface SmartSuggestionsOptions {
  maxSuggestions?: number;
  enablePreloading?: boolean;
  debounceDelay?: number;
  showRecentSearches?: boolean;
}

export const useSmartSuggestions = (
  query: string,
  origin: Origin = 'all',
  options: SmartSuggestionsOptions = {}
) => {
  const {
    maxSuggestions = 8,
    enablePreloading = true,
    debounceDelay = 150,
    showRecentSearches = true
  } = options;

  const { currentWorkspace } = useWorkspace();
  const { assignedSources } = useEmissionFactorAccess();
  const { recentSearches } = useSearchHistory();

  // États
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs pour stabilité et debouncing
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastQueryRef = useRef<string>('');
  const requestCounterRef = useRef(0);

  // Initialiser le contexte du manager
  useEffect(() => {
    smartSuggestionManager.updateContext({
      workspaceId: currentWorkspace?.id,
      assignedSources,
      origin,
      recentSearches: showRecentSearches ? (recentSearches || []) : [],
      userLanguage: 'fr' // TODO: récupérer depuis le contexte utilisateur
    });
  }, [currentWorkspace?.id, assignedSources, origin, recentSearches, showRecentSearches]);

  // Préchargement des préfixes populaires
  useEffect(() => {
    // Désactiver le préchargement en développement si Algolia peut être bloqué
    if (import.meta.env.DEV) {
      // Log une seule fois par session
      if (!sessionStorage.getItem('suggestions_preload_disabled_logged')) {
        console.log('🔄 Préchargement suggestions désactivé en développement (Algolia restrictions)');
        sessionStorage.setItem('suggestions_preload_disabled_logged', 'true');
      }
      return;
    }
    
    if (enablePreloading && recentSearches && recentSearches.length > 0) {
      smartSuggestionManager.preloadPopularPrefixes(recentSearches.slice(0, 10));
    }
  }, [enablePreloading, recentSearches]);

  // Fonction de récupération des suggestions
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    // Désactiver les suggestions en développement si Algolia bloqué
    if (import.meta.env.DEV) {
      console.log('🔄 Suggestions désactivées en développement');
      setSuggestions([]);
      setLoading(false);
      return;
    }
    
    const currentRequestId = ++requestCounterRef.current;
    
    try {
      setLoading(true);
      setError(null);

      const results = await smartSuggestionManager.getSuggestions(
        searchQuery,
        maxSuggestions
      );

      // Vérifier si cette requête est toujours pertinente
      if (currentRequestId === requestCounterRef.current) {
        setSuggestions(results);
      }
    } catch (err: any) {
      if (currentRequestId === requestCounterRef.current) {
        setError(err.message || 'Erreur lors de la récupération des suggestions');
        setSuggestions([]);
      }
    } finally {
      if (currentRequestId === requestCounterRef.current) {
        setLoading(false);
      }
    }
  }, [maxSuggestions]);

  // Debounced fetch
  const debouncedFetch = useCallback((searchQuery: string) => {
    // Désactiver les suggestions en développement si Algolia bloqué
    if (import.meta.env.DEV) {
      console.log('🔄 Debounced suggestions désactivé en développement');
      return;
    }
    
    // Nettoyer le timeout précédent
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Si la requête est vide, afficher immédiatement les recherches récentes
    if (searchQuery.trim().length === 0) {
      fetchSuggestions(searchQuery);
      return;
    }

    // Délai adaptatif basé sur la longueur de la requête
    let delay = debounceDelay;
    if (searchQuery.length < 3) {
      delay = Math.max(100, debounceDelay * 0.5); // Plus rapide pour les requêtes courtes
    } else if (searchQuery.length > 6) {
      delay = Math.min(300, debounceDelay * 1.5); // Plus lent pour les requêtes longues
    }

    debounceTimeoutRef.current = setTimeout(() => {
      fetchSuggestions(searchQuery);
    }, delay);
  }, [fetchSuggestions, debounceDelay]);

  // Effet principal pour surveiller les changements de requête
  useEffect(() => {
    if (query !== lastQueryRef.current) {
      lastQueryRef.current = query;
      debouncedFetch(query);
    }

    // Cleanup
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [query, debouncedFetch]);

  // Cleanup à la destruction du composant
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Fonctions utilitaires
  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setError(null);
    setLoading(false);
    
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
  }, []);

  const refreshSuggestions = useCallback(() => {
    fetchSuggestions(query);
  }, [query, fetchSuggestions]);

  const getCacheStats = useCallback(() => {
    return smartSuggestionManager.getCacheStats();
  }, []);

  // Précharger des suggestions pour une requête donnée
  const preloadSuggestions = useCallback((targetQuery: string) => {
    // Désactiver le préchargement en développement si Algolia bloqué
    if (import.meta.env.DEV) {
      console.log('🔄 Préchargement suggestions désactivé en développement');
      return;
    }
    
    smartSuggestionManager.getSuggestions(targetQuery, maxSuggestions);
  }, [maxSuggestions]);

  return {
    suggestions,
    loading,
    error,
    
    // Fonctions utilitaires
    clearSuggestions,
    refreshSuggestions,
    getCacheStats,
    preloadSuggestions,
    
    // Métadonnées
    hasResults: suggestions.length > 0,
    isEmpty: !loading && suggestions.length === 0 && query.trim().length > 0,
    isRecentSearches: suggestions.length > 0 && suggestions.every(s => s.category === 'Recherches récentes')
  };
};

// Hook spécialisé pour la searchbox avec fonctionnalités avancées
export const useSearchBoxSuggestions = (
  query: string,
  origin: Origin = 'all',
  options: SmartSuggestionsOptions & {
    showCategories?: boolean;
    groupByCategory?: boolean;
    highlightMatches?: boolean;
  } = {}
) => {
  const {
    showCategories = true,
    groupByCategory = false,
    highlightMatches = true,
    ...suggestionsOptions
  } = options;

  const {
    suggestions: rawSuggestions,
    loading,
    error,
    ...otherProps
  } = useSmartSuggestions(query, origin, suggestionsOptions);

  // Traitement des suggestions pour la searchbox
  const processedSuggestions = useRef<{
    suggestions: SuggestionItem[];
    groupedSuggestions: Record<string, SuggestionItem[]>;
    highlightedSuggestions: Array<SuggestionItem & { highlightedLabel?: string }>;
  }>({ suggestions: [], groupedSuggestions: {}, highlightedSuggestions: [] });

  useEffect(() => {
    const highlighted = highlightMatches 
      ? rawSuggestions.map(suggestion => ({
          ...suggestion,
          highlightedLabel: highlightMatch(suggestion.label, query)
        }))
      : rawSuggestions;

    const grouped = groupByCategory 
      ? groupSuggestionsByCategory(highlighted)
      : {};

    processedSuggestions.current = {
      suggestions: rawSuggestions,
      groupedSuggestions: grouped,
      highlightedSuggestions: highlighted
    };
  }, [rawSuggestions, query, groupByCategory, highlightMatches]);

  return {
    suggestions: processedSuggestions.current.suggestions,
    groupedSuggestions: processedSuggestions.current.groupedSuggestions,
    highlightedSuggestions: processedSuggestions.current.highlightedSuggestions,
    loading,
    error,
    ...otherProps
  };
};

// Fonctions utilitaires
function highlightMatch(text: string, query: string): string {
  if (!query.trim()) return text;
  
  const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function groupSuggestionsByCategory(suggestions: SuggestionItem[]): Record<string, SuggestionItem[]> {
  return suggestions.reduce((groups, suggestion) => {
    const category = suggestion.category || 'Autres';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(suggestion);
    return groups;
  }, {} as Record<string, SuggestionItem[]>);
}

export default useSmartSuggestions;
