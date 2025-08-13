import React, { createContext, useContext, useMemo, useEffect, useState, useRef } from 'react';
import { InstantSearch } from 'react-instantsearch';
import { liteClient as algoliasearch } from 'algoliasearch/lite';
import { useQuotas } from '@/hooks/useQuotas';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { INDEX_ALL } from '@/config/search';
import { VALID_ALGOLIA_PARAMS, sanitizeFacetFilters, resolveOrigin, mergeFederatedPair, buildPrivateFilters, type Origin } from '@/lib/algolia/searchClient';
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
    const cleaned = (requests || []).map((r) => {
      const params = Object.fromEntries(
        Object.entries(r.params || {}).filter(([k]) => VALID_ALGOLIA_PARAMS.includes(k))
      );
      return { ...r, params };
    });
    return rawSearchClient.search(cleaned);
  }
});

const QuotaContext = createContext<ReturnType<typeof useQuotas> | null>(null);
export const useQuotaContext = () => {
  const ctx = useContext(QuotaContext);
  if (!ctx) throw new Error('useQuotaContext must be used within SearchProvider');
  return ctx;
};

// Contexte d'origine pour synchroniser SearchFilters, SearchBox/useSuggestions, etc.
export const OriginContext = createContext<{ origin: Origin; setOrigin: (o: Origin) => void } | null>(null);
export const useOrigin = () => {
  const ctx = useContext(OriginContext);
  if (!ctx) throw new Error('useOrigin must be used within SearchProvider');
  return ctx;
};
export const useOptionalOrigin = () => {
  return useContext(OriginContext);
};

// Provider autonome d'origine (sans InstantSearch). Utile pour /favoris
export const OriginProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [origin, setOrigin] = useState<Origin>('all');
  return (
    <OriginContext.Provider value={{ origin, setOrigin }}>
      {children}
    </OriginContext.Provider>
  );
};

interface SearchProviderProps { children: React.ReactNode; }

export const SearchProvider: React.FC<SearchProviderProps> = ({ children }) => {
  const quotaHook = useQuotas();
  const { currentWorkspace } = useWorkspace();
  const { assignedSources } = useEmissionFactorAccess();
  const dual = useDualAlgoliaClients(currentWorkspace?.id);
  const [origin, setOrigin] = useState<Origin>('all');
  const originRef = useRef<Origin>('all');
  useEffect(() => { originRef.current = origin; }, [origin]);
  // Stabiliser la référence du client retourné par useMemo en évitant de dépendre d'objets non stables
  const workspaceIdRef = useRef<string | undefined>(currentWorkspace?.id);
  useEffect(() => { workspaceIdRef.current = currentWorkspace?.id; }, [currentWorkspace?.id]);

  const clients = dual;
  
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

  const searchClientRef = useRef<any>(null);
  if (clients && !searchClientRef.current) {
    searchClientRef.current = {
      search: async (requests: any[]) => {
        if (import.meta.env.DEV) {
          console.log('[SearchProvider] incoming requests', requests?.map((r) => ({ ruleContexts: r?.params?.ruleContexts, facetFilters: r?.params?.facetFilters })));
        }
        const cleaningFull = cleaningFullRef.current;
        const cleaningTeaser = cleaningTeaserRef.current;
        if (!cleaningFull) return { results: [] };
        const wsId = workspaceIdRef.current;
        const expandedFull: any[] = [];
        const expandedTeaser: any[] = [];

        for (const r of requests || []) {
          const baseParams = { ...(r.params || {}) };
          const safeFacetFilters = sanitizeFacetFilters(baseParams.facetFilters);
          let reqOrigin = resolveOrigin(baseParams);
          // Forcer l'origine globale si sélectionnée
          if (originRef.current !== 'all') reqOrigin = originRef.current;
          const privFilters = buildPrivateFilters(wsId);
          if (import.meta.env.DEV) {
            console.log('[SearchProvider] resolveOrigin', { globalOrigin: originRef.current, ruleContexts: baseParams.ruleContexts, facetFilters: baseParams.facetFilters, resolved: reqOrigin });
          }

          if (reqOrigin === 'public') {
            expandedFull.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:public'], ...(safeFacetFilters || [])] } });
            expandedTeaser.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:public'], ...(safeFacetFilters || [])] } });
          } else if (reqOrigin === 'private') {
            expandedFull.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:private'], ...(safeFacetFilters || [])], filters: privFilters } });
          } else {
            expandedFull.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: safeFacetFilters } });
            expandedTeaser.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:public'], ...(safeFacetFilters || [])] } });
            expandedFull.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:private'], ...(safeFacetFilters || [])], filters: privFilters } });
          }
        }

        if (import.meta.env.DEV) {
          console.log('[SearchProvider] expandedFull', expandedFull?.map((r) => ({ facetFilters: r?.params?.facetFilters, filters: r?.params?.filters })));
          console.log('[SearchProvider] expandedTeaser', expandedTeaser?.map((r) => ({ facetFilters: r?.params?.facetFilters, filters: r?.params?.filters })));
        }

        const [resFull, resTeaser] = await Promise.all([
          cleaningFull.search(expandedFull),
          cleaningTeaser?.search(expandedTeaser) ?? Promise.resolve({ results: [] })
        ]);
        const merged = [] as any[];
        for (let i = 0, jFull = 0, jTeaser = 0; i < (requests || []).length; i++) {
          const originalParams = (requests || [])[i]?.params || {};
          let mergeOrigin = resolveOrigin(originalParams);
          if (originRef.current !== 'all') mergeOrigin = originRef.current;
          if (mergeOrigin === 'public') {
            const publicFull = resFull.results[jFull]; jFull++;
            const publicTeaser = (resTeaser as any).results?.[jTeaser]; jTeaser++;
            merged.push(mergeFederatedPair(publicFull, publicTeaser));
          } else if (mergeOrigin === 'private') {
            // Make sure private request doesn't get an accidental public result (alignment)
            const privateRes = resFull.results[jFull]; jFull += 1;
            merged.push(privateRes);
          } else {
            const publicFull = resFull.results[jFull]; jFull++;
            const publicTeaser = (resTeaser as any).results?.[jTeaser]; jTeaser++;
            const mergedPublic = mergeFederatedPair(publicFull, publicTeaser);
            const privateResult = resFull.results[jFull]; jFull++;
            merged.push(mergeFederatedPair(mergedPublic, privateResult));
          }
        }
        if (import.meta.env.DEV) {
          console.log('[SearchProvider] merged results stats', merged?.map((r) => ({ nbHits: r?.nbHits })));
        }
        return { results: merged };
      }
    };
  }

  const searchClient = clients ? searchClientRef.current : null;

  return (
    <QuotaContext.Provider value={quotaHook}>
      <OriginContext.Provider value={{ origin, setOrigin }}>
        {searchClient ? (
          <InstantSearch searchClient={searchClient as any} indexName={INDEX_ALL} future={{ preserveSharedStateOnUnmount: true }}>
            {children}
          </InstantSearch>
        ) : (
          <div />
        )}
      </OriginContext.Provider>
    </QuotaContext.Provider>
  );
};