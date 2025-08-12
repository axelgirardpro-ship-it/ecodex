import React, { createContext, useContext, useMemo } from 'react';
import { InstantSearch } from 'react-instantsearch';
import { liteClient as algoliasearch, SearchResponse } from 'algoliasearch/lite';
import { useQuotas } from '@/hooks/useQuotas';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { INDEX_PRIVATE, INDEX_PUBLIC } from '@/config/search';
import { VALID_ALGOLIA_PARAMS, sanitizeFacetFilters, resolveOrigin, mergeFederatedPair, buildFavoriteIdsFilter, buildPublicFilters, buildPrivateFilters, favoriteIdsKey } from '@/lib/algolia/searchClient';

const ALGOLIA_APPLICATION_ID = import.meta.env.VITE_ALGOLIA_APPLICATION_ID || '6BGAS85TYS';
const ALGOLIA_SEARCH_API_KEY = import.meta.env.VITE_ALGOLIA_SEARCH_API_KEY || 'e06b7614aaff866708fbd2872de90d37';
const rawSearchClient = algoliasearch(ALGOLIA_APPLICATION_ID, ALGOLIA_SEARCH_API_KEY);

const cleaningClient = {
  ...rawSearchClient,
  search: (requests: any[]) => {
    const cleaned = (requests || []).map((r) => ({
      ...r,
      params: Object.fromEntries(Object.entries(r.params || {}).filter(([k]) => VALID_ALGOLIA_PARAMS.includes(k)))
    }));
    return rawSearchClient.search(cleaned);
  }
};

const FavorisQuotaContext = createContext<ReturnType<typeof useQuotas> | null>(null);
export const useFavorisQuotaContext = () => {
  const ctx = useContext(FavorisQuotaContext);
  if (!ctx) throw new Error('useFavorisQuotaContext must be used within FavorisSearchProvider');
  return ctx;
};

interface FavorisSearchProviderProps { 
  children: React.ReactNode;
  favoriteIds?: string[];
}

export const FavorisSearchProvider: React.FC<FavorisSearchProviderProps> = ({ children, favoriteIds = [] }) => {
  const quotaHook = useQuotas();
  const { currentWorkspace } = useWorkspace();

  const searchClient = useMemo(() => {
    const idsKey = favoriteIdsKey(favoriteIds);
    return {
      ...cleaningClient,
      search: async (requests: any[]) => {
        const wsId = currentWorkspace?.id;
        const expanded: any[] = [];
        
        for (const r of requests || []) {
          const baseParams = { ...(r.params || {}) };
          const safeFacetFilters = sanitizeFacetFilters(baseParams.facetFilters);
          const origin = resolveOrigin(baseParams);
          const favFilter = buildFavoriteIdsFilter(favoriteIds);

          const pubFilters = buildPublicFilters(wsId, favFilter);
          const privFilters = buildPrivateFilters(wsId, favFilter);

          if (origin === 'public') {
            expanded.push({ ...r, indexName: INDEX_PUBLIC, params: { ...baseParams, facetFilters: safeFacetFilters, filters: pubFilters } });
          } else if (origin === 'private') {
            expanded.push({ ...r, indexName: INDEX_PRIVATE, params: { ...baseParams, facetFilters: safeFacetFilters, filters: privFilters } });
          } else {
            expanded.push({ ...r, indexName: INDEX_PUBLIC, params: { ...baseParams, facetFilters: safeFacetFilters, filters: pubFilters } });
            expanded.push({ ...r, indexName: INDEX_PRIVATE, params: { ...baseParams, facetFilters: safeFacetFilters, filters: privFilters } });
          }
        }
        
        const res = await cleaningClient.search(expanded);
        const merged = [] as any[];
        for (let i = 0, j = 0; i < (requests || []).length; i++) {
          const originalParams = (requests || [])[i]?.params || {};
          const origin = resolveOrigin(originalParams);
          if (origin === 'public' || origin === 'private') {
            merged.push(res.results[j]); j += 1;
          } else {
            const publicResult = res.results[j] as SearchResponse<any>; j++;
            const privateResult = res.results[j] as SearchResponse<any>; j++;
            merged.push(mergeFederatedPair(publicResult, privateResult));
          }
        }
        return { results: merged };
      }
    };
  }, [currentWorkspace?.id, favoriteIdsKey(favoriteIds)]);

  return (
    <FavorisQuotaContext.Provider value={quotaHook}>
      <InstantSearch searchClient={searchClient as any} indexName={INDEX_PUBLIC} future={{ preserveSharedStateOnUnmount: true }}>
        {children}
      </InstantSearch>
    </FavorisQuotaContext.Provider>
  );
};