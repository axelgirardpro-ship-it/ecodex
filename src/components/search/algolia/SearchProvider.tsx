import React, { createContext, useContext, useMemo, useEffect, useState, useRef } from 'react';
import { InstantSearch } from 'react-instantsearch';
import { liteClient as algoliasearch } from 'algoliasearch/lite';
import { supabase } from '@/integrations/supabase/client';
import { useQuotas } from '@/hooks/useQuotas';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { INDEX_ALL } from '@/config/search';
import { VALID_ALGOLIA_PARAMS, sanitizeFacetFilters, resolveOrigin, mergeFederatedPair, buildPrivateFilters, type Origin } from '@/lib/algolia/searchClient';
import { useEmissionFactorAccess } from '@/hooks/useEmissionFactorAccess';
import { USE_SECURED_KEYS } from '@/config/featureFlags';

const FALLBACK_APP_ID = import.meta.env.VITE_ALGOLIA_APPLICATION_ID || '6BGAS85TYS';
const FALLBACK_SEARCH_KEY = import.meta.env.VITE_ALGOLIA_SEARCH_API_KEY || 'e06b7614aaff866708fbd2872de90d37';

function useDualAlgoliaClients(workspaceId?: string) {
  const [clients, setClients] = useState<{ fullPublic: any, fullPrivate: any, teaser: any } | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const isLocalhost = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
      if (isLocalhost) {
        if (!cancelled) {
          setClients({
            fullPublic: algoliasearch(FALLBACK_APP_ID, FALLBACK_SEARCH_KEY),
            fullPrivate: algoliasearch(FALLBACK_APP_ID, FALLBACK_SEARCH_KEY),
            teaser: algoliasearch(FALLBACK_APP_ID, FALLBACK_SEARCH_KEY)
          });
        }
        return;
      }
      if (USE_SECURED_KEYS) {
        try {
          const body = workspaceId ? { workspaceId } : {} as any;
          const { data, error } = await supabase.functions.invoke('algolia-secure-key', { body });
          if (error) throw error;
          const payload: any = data || {};
          if (!cancelled && payload?.appId) {
            setClients({
              fullPublic: algoliasearch(payload.appId, payload.fullPublic?.searchApiKey || payload.full?.searchApiKey),
              fullPrivate: algoliasearch(payload.appId, payload.fullPrivate?.searchApiKey || payload.full?.searchApiKey),
              teaser: algoliasearch(payload.appId, payload.teaserPublic?.searchApiKey || payload.teaser?.searchApiKey)
            });
            return;
          }
        } catch (err) {
          if (!cancelled) {
            setClients({
              fullPublic: algoliasearch(FALLBACK_APP_ID, FALLBACK_SEARCH_KEY),
              fullPrivate: algoliasearch(FALLBACK_APP_ID, FALLBACK_SEARCH_KEY),
              teaser: algoliasearch(FALLBACK_APP_ID, FALLBACK_SEARCH_KEY)
            });
            return;
          }
        }
      }
      // En prod cloud sans clés sécurisées: ne rien initialiser pour forcer l'erreur visible plutôt que du faux positif
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
  
  const cleaningFullPublicRef = useRef<any>(null);
  const cleaningFullPrivateRef = useRef<any>(null);
  const cleaningTeaserRef = useRef<any>(null);
  useEffect(() => {
    if (clients) {
      cleaningFullPublicRef.current = cleaningWrapper(clients.fullPublic);
      cleaningFullPrivateRef.current = cleaningWrapper(clients.fullPrivate);
      cleaningTeaserRef.current = cleaningWrapper(clients.teaser);
    } else {
      cleaningFullPublicRef.current = null;
      cleaningFullPrivateRef.current = null;
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
        const cleaningFullPublic = cleaningFullPublicRef.current;
        const cleaningFullPrivate = cleaningFullPrivateRef.current;
        const cleaningTeaser = cleaningTeaserRef.current;
        if (!cleaningFullPublic || !cleaningFullPrivate) return { results: [] };
        const wsId = workspaceIdRef.current;
        const expandedPublicFull: any[] = [];
        const expandedPrivateFull: any[] = [];
        const expandedTeaser: any[] = [];

        const combineFilters = (...parts: (string | undefined)[]) => {
          const arr = parts
            .filter((p) => typeof p === 'string' && p.trim().length > 0)
            .map((p) => p!.trim()) as string[];
          if (arr.length === 0) return undefined;
          if (arr.length === 1) return arr[0];
          // Algolia n’autorise pas la forme (X AND Y) OR Z. On force la/les clauses avec OR d’abord
          const withOr = arr.filter((p) => /\sOR\s/.test(p));
          const withoutOr = arr.filter((p) => !/\sOR\s/.test(p));
          const ordered = [...withOr, ...withoutOr];
          return ordered.map((p) => `(${p})`).join(' AND ');
        };

        // Figer l’origine pour l’ensemble du cycle
        const frozenOrigin = originRef.current;

        for (const r of requests || []) {
          const baseParams = { ...(r.params || {}) };
          const safeFacetFilters = sanitizeFacetFilters(baseParams.facetFilters);
          // Toujours privilégier l'origine globale (évite tout résidu de paramètres)
          const reqOrigin = frozenOrigin;
          const privFilters = buildPrivateFilters(wsId);
          if (import.meta.env.DEV) {
            console.log('[SearchProvider] resolveOrigin', { globalOrigin: frozenOrigin, ruleContexts: baseParams.ruleContexts, facetFilters: baseParams.facetFilters, resolved: reqOrigin });
          }

          if (reqOrigin === 'public') {
            expandedPublicFull.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:public'], ...(safeFacetFilters || [])], filters: combineFilters(baseParams.filters) } });
            expandedTeaser.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:public'], ...(safeFacetFilters || [])], filters: combineFilters(baseParams.filters) } });
          } else if (reqOrigin === 'private') {
            expandedPrivateFull.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:private'], ...(safeFacetFilters || [])], filters: combineFilters(baseParams.filters, privFilters) } });
          } else {
            // En mode "all", borner explicitement le flux public à scope:public pour garantir la séparation, même en local sans clés sécurisées
            expandedPublicFull.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:public'], ...(safeFacetFilters || [])], filters: combineFilters(baseParams.filters) } });
            expandedTeaser.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:public'], ...(safeFacetFilters || [])], filters: combineFilters(baseParams.filters) } });
            expandedPrivateFull.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:private'], ...(safeFacetFilters || [])], filters: combineFilters(baseParams.filters, privFilters) } });
          }
        }

        if (import.meta.env.DEV) {
          console.log('[SearchProvider] expandedPublicFull', expandedPublicFull?.map((r) => ({ facetFilters: r?.params?.facetFilters, filters: r?.params?.filters })));
          console.log('[SearchProvider] expandedPrivateFull', expandedPrivateFull?.map((r) => ({ facetFilters: r?.params?.facetFilters, filters: r?.params?.filters })));
          console.log('[SearchProvider] expandedTeaser', expandedTeaser?.map((r) => ({ facetFilters: r?.params?.facetFilters, filters: r?.params?.filters })));
        }

        const [resPublicFull, resPrivateFull, resTeaser] = await Promise.all([
          cleaningFullPublic.search(expandedPublicFull),
          cleaningFullPrivate.search(expandedPrivateFull),
          cleaningTeaser?.search(expandedTeaser) ?? Promise.resolve({ results: [] })
        ]);
        const merged = [] as any[];
        // Réponse vide par défaut (évite processingTimeMS undefined)
        const emptyRes: any = { hits: [], nbHits: 0, nbPages: 0, page: 0, processingTimeMS: 0, facets: {}, facets_stats: null, query: '', params: '' };
        for (let i = 0, jPub = 0, jPriv = 0, jTeaser = 0; i < (requests || []).length; i++) {
          const originalParams = (requests || [])[i]?.params || {};
          // Toujours utiliser l'origine globale pour décider du merge
          const mergeOrigin = frozenOrigin;
          if (mergeOrigin === 'public') {
            const publicFull = resPublicFull.results[jPub] || emptyRes; jPub++;
            const publicTeaser = (resTeaser as any).results?.[jTeaser] || emptyRes; jTeaser++;
            merged.push(mergeFederatedPair(publicFull, publicTeaser));
          } else if (mergeOrigin === 'private') {
            const privateRes = resPrivateFull.results[jPriv] || emptyRes; jPriv += 1;
            merged.push(privateRes);
          } else {
            const publicFull = resPublicFull.results[jPub] || emptyRes; jPub++;
            const publicTeaser = (resTeaser as any).results?.[jTeaser] || emptyRes; jTeaser++;
            const mergedPublic = mergeFederatedPair(publicFull, publicTeaser);
            const privateResult = resPrivateFull.results[jPriv] || emptyRes; jPriv++;
            // Additionner nbHits public+privé pour un comptage cohérent en mode "all"
            merged.push(mergeFederatedPair(mergedPublic, privateResult, { sumNbHits: true }));
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