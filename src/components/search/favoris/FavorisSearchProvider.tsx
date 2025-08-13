import React, { createContext, useContext, useMemo, useEffect, useState, useRef } from 'react';
import { InstantSearch } from 'react-instantsearch';
import { liteClient as algoliasearch, SearchResponse } from 'algoliasearch/lite';
import { useQuotas } from '@/hooks/useQuotas';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { INDEX_ALL } from '@/config/search';
import { VALID_ALGOLIA_PARAMS, sanitizeFacetFilters, resolveOrigin, mergeFederatedPair, buildFavoriteIdsFilter, buildPublicFiltersBySources, buildPrivateFilters, type Origin } from '@/lib/algolia/searchClient';
import { useOptionalOrigin } from '@/components/search/algolia/SearchProvider';
import { useEmissionFactorAccess } from '@/hooks/useEmissionFactorAccess';
import { USE_SECURED_KEYS } from '@/config/featureFlags';

const FALLBACK_APP_ID = import.meta.env.VITE_ALGOLIA_APPLICATION_ID || '6BGAS85TYS';
const FALLBACK_SEARCH_KEY = import.meta.env.VITE_ALGOLIA_SEARCH_API_KEY || 'e06b7614aaff866708fbd2872de90d37';

function useDualAlgoliaClients(workspaceId?: string) {
  const [clients, setClients] = useState<{ full: any, teaser: any } | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (USE_SECURED_KEYS) {
        try {
          const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
          const res = await fetch(`/functions/v1/algolia-secure-key${qs}`, { headers: { Authorization: `Bearer ${localStorage.getItem('sb-access-token') || ''}` } });
          if (res.ok) {
            const payload = await res.json();
            if (!cancelled) setClients({ full: algoliasearch(payload.appId, payload.full.searchApiKey), teaser: algoliasearch(payload.appId, payload.teaser.searchApiKey) });
            return;
          }
        } catch {}
      }
      if (!cancelled) setClients({ full: algoliasearch(FALLBACK_APP_ID, FALLBACK_SEARCH_KEY), teaser: algoliasearch(FALLBACK_APP_ID, FALLBACK_SEARCH_KEY) });
    }
    init();
    return () => { cancelled = true; };
  }, [workspaceId]);
  return clients;
}

const cleaningWrapper = (rawSearchClient: any) => ({
  ...rawSearchClient,
  search: (requests: any[]) => {
    const cleaned = (requests || []).map((r) => ({
      ...r,
      params: Object.fromEntries(Object.entries(r.params || {}).filter(([k]) => VALID_ALGOLIA_PARAMS.includes(k)))
    }));
    return rawSearchClient.search(cleaned);
  }
});

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
  const { assignedSources } = useEmissionFactorAccess();
  const clients = useDualAlgoliaClients(currentWorkspace?.id);
  const originCtx = useOptionalOrigin();
  const originRef = useRef<Origin>('all');
  useEffect(() => { if (originCtx?.origin) originRef.current = originCtx.origin; }, [originCtx?.origin]);
  const debug = (...args: any[]) => { if (import.meta.env.DEV) console.log('[FavorisProvider]', ...args); };
  const favoriteIdsRef = useRef<string[]>(favoriteIds);
  useEffect(() => { favoriteIdsRef.current = favoriteIds; }, [favoriteIds]);

  const cleaningFullRef = useRef<any>(null);
  const cleaningTeaserRef = useRef<any>(null);
  useEffect(() => {
    if (clients) {
      cleaningFullRef.current = cleaningWrapper(clients.full);
      cleaningTeaserRef.current = cleaningWrapper(clients.teaser);
    } else {
      cleaningFullRef.current = null;
      cleaningTeaserRef.current = null;
    }
  }, [clients]);

  const workspaceIdRef = useRef<string | undefined>(currentWorkspace?.id);
  useEffect(() => { workspaceIdRef.current = currentWorkspace?.id; }, [currentWorkspace?.id]);

  const searchClientRef = useRef<any>(null);
  if (clients && !searchClientRef.current) {
    searchClientRef.current = {
      search: async (requests: any[]) => {
        const cleaningFull = cleaningFullRef.current;
        const cleaningTeaser = cleaningTeaserRef.current;
        if (!cleaningFull) return { results: [] };
        const wsId = workspaceIdRef.current;
        debug('incoming requests', requests?.map((r) => ({ ruleContexts: r?.params?.ruleContexts, facetFilters: r?.params?.facetFilters })));
        debug('ctx', { globalOrigin: originRef.current, wsId, favCount: favoriteIdsRef.current?.length });
        const expandedFull: any[] = [];
        const expandedTeaser: any[] = [];

        for (const r of requests || []) {
          const baseParams = { ...(r.params || {}) };
          const safeFacetFilters = sanitizeFacetFilters(baseParams.facetFilters);
          let origin = resolveOrigin(baseParams);
          if (originRef.current !== 'all') origin = originRef.current;
          const favFilter = buildFavoriteIdsFilter(favoriteIdsRef.current);

          const privFilters = buildPrivateFilters(wsId, favFilter);
          debug('resolveOrigin', { globalOrigin: originRef.current, ruleContexts: baseParams.ruleContexts, facetFilters: baseParams.facetFilters, resolved: origin });

          if (origin === 'public') {
            expandedFull.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:public'], ...(safeFacetFilters || [])], filters: favFilter } });
            expandedTeaser.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:public'], ...(safeFacetFilters || [])], filters: favFilter } });
          } else if (origin === 'private') {
            expandedFull.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:private'], ...(safeFacetFilters || [])], filters: privFilters } });
          } else {
            expandedFull.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: safeFacetFilters, filters: favFilter } });
            expandedTeaser.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:public'], ...(safeFacetFilters || [])], filters: favFilter } });
            expandedFull.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:private'], ...(safeFacetFilters || [])], filters: privFilters } });
          }
        }

        debug('expandedFull', expandedFull?.map((r) => ({ facetFilters: r?.params?.facetFilters, filters: r?.params?.filters })));
        debug('expandedTeaser', expandedTeaser?.map((r) => ({ facetFilters: r?.params?.facetFilters, filters: r?.params?.filters })));

        const [resFull, resTeaser] = await Promise.all([
          cleaningFull.search(expandedFull),
          cleaningTeaser?.search(expandedTeaser) ?? Promise.resolve({ results: [] })
        ]);
        const merged = [] as any[];
        for (let i = 0, jFull = 0, jTeaser = 0; i < (requests || []).length; i++) {
          const originalParams = (requests || [])[i]?.params || {};
          let origin = resolveOrigin(originalParams);
          if (originRef.current !== 'all') origin = originRef.current;
          if (origin === 'public') {
            const publicFull = resFull.results[jFull] as SearchResponse<any>; jFull++;
            const publicTeaser = (resTeaser as any).results?.[jTeaser] as SearchResponse<any>; jTeaser++;
            merged.push(mergeFederatedPair(publicFull, publicTeaser));
          } else if (origin === 'private') {
            // Make sure private request doesn't get an accidental public result (alignment)
            const privateRes = resFull.results[jFull]; jFull += 1;
            merged.push(privateRes);
          } else {
            const publicFull = resFull.results[jFull] as SearchResponse<any>; jFull++;
            const publicTeaser = (resTeaser as any).results?.[jTeaser] as SearchResponse<any>; jTeaser++;
            const mergedPublic = mergeFederatedPair(publicFull, publicTeaser);
            const privateResult = resFull.results[jFull] as SearchResponse<any>; jFull++;
            merged.push(mergeFederatedPair(mergedPublic, privateResult));
          }
        }
        debug('merged results stats', merged?.map((r: any) => ({ nbHits: r?.nbHits })));
        return { results: merged };
      }
    };
  }

  const searchClient = clients ? searchClientRef.current : null;
  if (!searchClient) return null;

  return (
    <FavorisQuotaContext.Provider value={quotaHook}>
      <InstantSearch searchClient={searchClient as any} indexName={INDEX_ALL} future={{ preserveSharedStateOnUnmount: true }}>
        {children}
      </InstantSearch>
    </FavorisQuotaContext.Provider>
  );
};