import React, { createContext, useContext, useMemo } from 'react';
import { InstantSearch } from 'react-instantsearch';
import { liteClient as algoliasearch } from 'algoliasearch/lite';
import { useQuotas } from '@/hooks/useQuotas';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { INDEX_PRIVATE, INDEX_PUBLIC } from '@/config/search';
import { VALID_ALGOLIA_PARAMS, sanitizeFacetFilters, resolveOrigin, mergeFederatedPair } from '@/lib/algolia/searchClient';

const ALGOLIA_APPLICATION_ID = import.meta.env.VITE_ALGOLIA_APPLICATION_ID || '6BGAS85TYS';
const ALGOLIA_SEARCH_API_KEY = import.meta.env.VITE_ALGOLIA_SEARCH_API_KEY || 'e06b7614aaff866708fbd2872de90d37';
const rawSearchClient = algoliasearch(ALGOLIA_APPLICATION_ID, ALGOLIA_SEARCH_API_KEY);

const cleaningClient = {
  ...rawSearchClient,
  search: (requests: any[]) => {
    const cleaned = (requests || []).map((r) => {
      const params = Object.fromEntries(
        Object.entries(r.params || {}).filter(([k]) => VALID_ALGOLIA_PARAMS.includes(k))
      );
      return { ...r, params };
    });
    return rawSearchClient.search(cleaned);
  }
};

const QuotaContext = createContext<ReturnType<typeof useQuotas> | null>(null);
export const useQuotaContext = () => {
  const ctx = useContext(QuotaContext);
  if (!ctx) throw new Error('useQuotaContext must be used within SearchProvider');
  return ctx;
};

interface SearchProviderProps { children: React.ReactNode; }

export const SearchProvider: React.FC<SearchProviderProps> = ({ children }) => {
  const quotaHook = useQuotas();
  const { currentWorkspace } = useWorkspace();

  const federatedClient = useMemo(() => ({
    ...cleaningClient,
    search: async (requests: any[]) => {
      const wsId = currentWorkspace?.id;
      const expanded: any[] = [];
      const originsPerRequest: ('all'|'public'|'private')[] = [];

      for (const r of requests || []) {
        const baseParams = { ...(r.params || {}) };
        const origin = resolveOrigin(baseParams);
        originsPerRequest.push(origin);
        const safeFacetFilters = sanitizeFacetFilters(baseParams.facetFilters);

        const publicFilters = (() => {
          const base = '(access_level:standard) OR (is_blurred:true)';
          const ws = wsId ? ` OR (assigned_workspace_ids:${wsId})` : '';
          return base + ws;
        })();
        const privateFilters = wsId ? `workspace_id:${wsId}` : 'workspace_id:_none_';

        if (origin === 'public') {
          expanded.push({ ...r, indexName: INDEX_PUBLIC, params: { ...baseParams, facetFilters: safeFacetFilters, filters: publicFilters } });
        } else if (origin === 'private') {
          expanded.push({ ...r, indexName: INDEX_PRIVATE, params: { ...baseParams, facetFilters: safeFacetFilters, filters: privateFilters } });
        } else {
          expanded.push({ ...r, indexName: INDEX_PUBLIC, params: { ...baseParams, facetFilters: safeFacetFilters, filters: publicFilters } });
          expanded.push({ ...r, indexName: INDEX_PRIVATE, params: { ...baseParams, facetFilters: safeFacetFilters, filters: privateFilters } });
        }
      }

      const res = await cleaningClient.search(expanded);
      const merged = [] as any[];
      for (let i = 0, j = 0; i < (requests || []).length; i++) {
        const origin = originsPerRequest[i];
        if (origin === 'public' || origin === 'private') {
          merged.push(res.results[j]); j += 1;
        } else {
          const publicRes = res.results[j]; j++;
          const privateRes = res.results[j]; j++;
          merged.push(mergeFederatedPair(publicRes, privateRes));
        }
      }
      return { results: merged };
    }
  }), [currentWorkspace?.id]);

  return (
    <QuotaContext.Provider value={quotaHook}>
      <InstantSearch searchClient={federatedClient as any} indexName={INDEX_PUBLIC} future={{ preserveSharedStateOnUnmount: true }}>
        {children}
      </InstantSearch>
    </QuotaContext.Provider>
  );
};