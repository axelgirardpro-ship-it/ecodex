import { useMemo, useCallback, useRef, useEffect } from 'react';
import { useFavorites } from '@/contexts/FavoritesContext';
import { EmissionFactor } from '@/types/emission-factor';

interface PerformanceMetrics {
  lastLoadTime: number;
  totalLoadTime: number;
  cacheHits: number;
  cacheMisses: number;
}

export const useOptimizedFavorites = () => {
  const { favorites, loading, addToFavorites, removeFromFavorites, isFavorite, refreshFavorites } = useFavorites();
  const metricsRef = useRef<PerformanceMetrics>({
    lastLoadTime: 0,
    totalLoadTime: 0,
    cacheHits: 0,
    cacheMisses: 0
  });

  // Performance monitoring
  const startTime = useRef<number>(0);

  useEffect(() => {
    if (loading && !startTime.current) {
      startTime.current = performance.now();
    } else if (!loading && startTime.current) {
      const loadTime = performance.now() - startTime.current;
      metricsRef.current.lastLoadTime = loadTime;
      metricsRef.current.totalLoadTime += loadTime;
      
      if (process.env.NODE_ENV === 'development') {
        console.log(`🚀 Favorites loaded in ${Math.round(loadTime)}ms`);
      }
      
      startTime.current = 0;
    }
  }, [loading]);

  // Optimized favorites sorting and filtering helpers
  const sortedFavorites = useMemo(() => {
    return [...favorites].sort((a, b) => {
      // Sort by date (newest first), then by name
      if (a.date !== b.date) {
        return b.date - a.date;
      }
      return a.nom.localeCompare(b.nom);
    });
  }, [favorites]);

  // Quick search function with debouncing
  const createSearchFilter = useCallback((searchTerm: string) => {
    if (!searchTerm.trim()) return () => true;
    
    const searchLower = searchTerm.toLowerCase();
    const searchWords = searchLower.split(' ').filter(word => word.length > 0);
    
    return (favorite: EmissionFactor) => {
      const searchableText = [
        favorite.nom,
        favorite.description,
        favorite.source,
        favorite.secteur,
        favorite.sousSecteur,
        favorite.contributeur,
        favorite.localisation
      ].join(' ').toLowerCase();
      
      return searchWords.every(word => searchableText.includes(word));
    };
  }, []);

  // Fast filtering with memoization
  const filterFavorites = useCallback((filters: {
    search?: string;
    source?: string;
    localisation?: string;
    date?: string;
    importType?: 'all' | 'imported' | 'not_imported';
  }) => {
    let filtered = sortedFavorites;
    
    // Apply search filter
    if (filters.search) {
      const searchFilter = createSearchFilter(filters.search);
      filtered = filtered.filter(searchFilter);
    }
    
    // Apply other filters
    if (filters.source) {
      filtered = filtered.filter(f => f.source === filters.source);
    }
    
    if (filters.localisation) {
      filtered = filtered.filter(f => f.localisation === filters.localisation);
    }
    
    if (filters.date) {
      filtered = filtered.filter(f => f.date.toString() === filters.date);
    }
    
    if (filters.importType && filters.importType !== 'all') {
      filtered = filtered.filter(f => {
        const isImported = Boolean((f as any).workspace_id);
        return filters.importType === 'imported' ? isImported : !isImported;
      });
    }
    
    return filtered;
  }, [sortedFavorites, createSearchFilter]);

  // Optimized filter options generation
  const filterOptions = useMemo(() => {
    const sources = new Set<string>();
    const locations = new Set<string>();
    const dates = new Set<number>();
    
    favorites.forEach(f => {
      if (f.source) sources.add(f.source);
      if (f.localisation) locations.add(f.localisation);
      if (f.date) dates.add(f.date);
    });
    
    return {
      sources: Array.from(sources).sort(),
      locations: Array.from(locations).sort(),
      dates: Array.from(dates).sort().reverse().map(String)
    };
  }, [favorites]);

  // Optimized batch operations
  const batchRemoveFavorites = useCallback(async (itemIds: string[]) => {
    const startTime = performance.now();
    
    try {
      await Promise.all(itemIds.map(id => removeFromFavorites(id)));
      
      if (process.env.NODE_ENV === 'development') {
        const endTime = performance.now();
        console.log(`🗑️ Batch removed ${itemIds.length} favorites in ${Math.round(endTime - startTime)}ms`);
      }
    } catch (error) {
      console.error('Error in batch remove:', error);
      throw error;
    }
  }, [removeFromFavorites]);

  // Performance metrics getter
  const getPerformanceMetrics = useCallback(() => {
    return {
      ...metricsRef.current,
      averageLoadTime: metricsRef.current.totalLoadTime / Math.max(1, metricsRef.current.cacheHits + metricsRef.current.cacheMisses),
      favoriteCount: favorites.length
    };
  }, [favorites.length]);

  // Optimized refresh with performance tracking
  const optimizedRefresh = useCallback(async (forceRefresh = false) => {
    const start = performance.now();
    
    try {
      await refreshFavorites(forceRefresh);
      
      if (forceRefresh) {
        metricsRef.current.cacheMisses++;
      } else {
        metricsRef.current.cacheHits++;
      }
    } finally {
      if (process.env.NODE_ENV === 'development') {
        const end = performance.now();
        console.log(`🔄 Favorites refresh took ${Math.round(end - start)}ms ${forceRefresh ? '(forced)' : '(cached)'}`);
      }
    }
  }, [refreshFavorites]);

  return {
    // Data
    favorites: sortedFavorites,
    loading,
    filterOptions,
    
    // Core operations
    addToFavorites,
    removeFromFavorites,
    isFavorite,
    refreshFavorites: optimizedRefresh,
    
    // Optimized operations
    filterFavorites,
    batchRemoveFavorites,
    createSearchFilter,
    
    // Performance monitoring
    getPerformanceMetrics,
    
    // Stats
    stats: {
      total: favorites.length,
      sources: filterOptions.sources.length,
      locations: filterOptions.locations.length,
      years: filterOptions.dates.length
    }
  };
};