// DEPRECATED: Legacy hook de filtrage côté client des favoris.
// Les favoris sont désormais filtrés côté Algolia.
// Ce fichier ne doit plus être utilisé et pourra être supprimé après validation.

export const useOptimizedFavorites = () => {
  console.warn('[deprecated] useOptimizedFavorites appelé. Utiliser les filtres Algolia.');
  return {
    favorites: [],
    loading: false,
    filterOptions: { sources: [], locations: [], dates: [] },
    addToFavorites: async () => {},
    removeFromFavorites: async () => {},
    isFavorite: () => false,
    refreshFavorites: async () => {},
    filterFavorites: () => [],
    batchRemoveFavorites: async () => {},
    createSearchFilter: () => () => true,
    getPerformanceMetrics: () => ({ lastLoadTime: 0, totalLoadTime: 0, cacheHits: 0, cacheMisses: 0, averageLoadTime: 0, favoriteCount: 0 }),
    stats: { total: 0, sources: 0, locations: 0, years: 0 },
  };
};