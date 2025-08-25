import React, { createContext, useContext, useMemo, useEffect, useState, useRef } from 'react';
import { InstantSearch, useInstantSearch } from 'react-instantsearch';
import { liteClient as algoliasearch, SearchResponse } from 'algoliasearch/lite';
import { supabase } from '@/integrations/supabase/client';
import { useQuotas } from '@/hooks/useQuotas';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { INDEX_ALL } from '@/config/search';
import { VALID_ALGOLIA_PARAMS, sanitizeFacetFilters, resolveOrigin, mergeFederatedPair, buildFavoriteIdsFilter, buildPublicFiltersBySources, buildPrivateFilters, type Origin } from '@/lib/algolia/searchClient';
import { useOptionalOrigin } from '@/components/search/algolia/SearchProvider';
import { useEmissionFactorAccess } from '@/hooks/useEmissionFactorAccess';
import { DEBUG_MULTI_INDEX } from '@/config/featureFlags';
import { createProxyClient } from '@/lib/algolia/proxySearchClient';

const FALLBACK_APP_ID = import.meta.env.VITE_ALGOLIA_APPLICATION_ID || '6SRUR7BWK6';
const FALLBACK_SEARCH_KEY = import.meta.env.VITE_ALGOLIA_SEARCH_API_KEY || 'fc0765efc9e509bd25acc5207150f32f';

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
      // Utiliser le proxy de recherche sécurisé au lieu des clés directes
      if (!cancelled) {
        setClients({
          fullPublic: createProxyClient('fullPublic'),
          fullPrivate: createProxyClient('fullPrivate'),
          teaser: createProxyClient('teaserPublic')
        });
      }
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
  const originRef = useRef<Origin>('public'); // Fallback sur base commune
  useEffect(() => { if (originCtx?.origin) originRef.current = originCtx.origin; }, [originCtx?.origin]);
  const debug = (...args: any[]) => { if (import.meta.env.DEV) console.log('[FavorisProvider]', ...args); };
  const favoriteIdsRef = useRef<string[]>(favoriteIds);
  useEffect(() => { favoriteIdsRef.current = favoriteIds; }, [favoriteIds]);

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

  const workspaceIdRef = useRef<string | undefined>(currentWorkspace?.id);
  useEffect(() => { workspaceIdRef.current = currentWorkspace?.id; }, [currentWorkspace?.id]);

  const searchClientRef = useRef<any>(null);
  if (clients && !searchClientRef.current) {
    searchClientRef.current = {
      search: async (requests: any[]) => {
        try {
          const cleaningFullPublic = cleaningFullPublicRef.current;
          const cleaningFullPrivate = cleaningFullPrivateRef.current;
          const cleaningTeaser = cleaningTeaserRef.current;
          if (!cleaningFullPublic || !cleaningFullPrivate) return { results: [] };
          const wsId = workspaceIdRef.current;
          const frozenOrigin = originRef.current; // Eviter les décalages lors d’un toggle rapide
          if (DEBUG_MULTI_INDEX) {
            debug('incoming requests', requests?.map((r) => ({ ruleContexts: r?.params?.ruleContexts, facetFilters: r?.params?.facetFilters })));
            debug('ctx', { globalOrigin: frozenOrigin, wsId, favCount: favoriteIdsRef.current?.length });
          }

          // Aucun seuil 3 caractères sur Favoris (comportement demandé)
          const expandedPublicFull: any[] = [];
          const expandedPrivateFull: any[] = [];
          const expandedTeaser: any[] = [];

          const combineFilters = (...parts: (string | undefined)[]) => {
            const arr = parts
              .filter((p) => typeof p === 'string' && p.trim().length > 0)
              .map((p) => p!.trim()) as string[];
            if (arr.length === 0) return undefined;
            if (arr.length === 1) return arr[0];
            const withOr = arr.filter((p) => /\sOR\s/.test(p));
            const withoutOr = arr.filter((p) => !/\sOR\s/.test(p));
            const ordered = [...withOr, ...withoutOr];
            return ordered.map((p) => `(${p})`).join(' AND ');
          };

          for (const r of requests || []) {
            const baseParams = { ...(r.params || {}) };
            const safeFacetFilters = sanitizeFacetFilters(baseParams.facetFilters);
            // Toujours privilégier l'origine globale (évite tout résidu de paramètres)
            const origin = frozenOrigin;
            const favFilter = buildFavoriteIdsFilter(favoriteIdsRef.current);

            // Séparer filtre workspace pour Algolia (éviter AND inclus dans une même clause)
            const wsFilter = wsId ? `workspace_id:${wsId}` : 'workspace_id:_none_';

            const privFilters = wsFilter; // pas d'AND ici, on laisse combineFilters gérer
            if (DEBUG_MULTI_INDEX) {
              debug('resolveOrigin', { globalOrigin: frozenOrigin, ruleContexts: baseParams.ruleContexts, facetFilters: baseParams.facetFilters, resolved: origin });
            }

            if (origin === 'public') {
              expandedPublicFull.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:public'], ...(safeFacetFilters || [])], filters: combineFilters(baseParams.filters, favFilter) } });
              expandedTeaser.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:public'], ...(safeFacetFilters || [])], filters: combineFilters(baseParams.filters, favFilter) } });
            } else if (origin === 'private') {
              expandedPrivateFull.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:private'], ...(safeFacetFilters || [])], filters: combineFilters(baseParams.filters, privFilters, favFilter) } });
            } else {
              // En mode "all", borner explicitement le flux public à scope:public
              expandedPublicFull.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:public'], ...(safeFacetFilters || [])], filters: combineFilters(baseParams.filters, favFilter) } });
              expandedTeaser.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:public'], ...(safeFacetFilters || [])], filters: combineFilters(baseParams.filters, favFilter) } });
              expandedPrivateFull.push({ ...r, indexName: INDEX_ALL, params: { ...baseParams, facetFilters: [['scope:private'], ...(safeFacetFilters || [])], filters: combineFilters(baseParams.filters, privFilters, favFilter) } });
            }
          }

          if (DEBUG_MULTI_INDEX) {
            debug('expandedPublicFull', expandedPublicFull?.map((r) => ({ facetFilters: r?.params?.facetFilters, filters: r?.params?.filters })));
            debug('expandedPrivateFull', expandedPrivateFull?.map((r) => ({ facetFilters: r?.params?.facetFilters, filters: r?.params?.filters })));
            debug('expandedTeaser', expandedTeaser?.map((r) => ({ facetFilters: r?.params?.facetFilters, filters: r?.params?.filters })));
          }

          const [resPublicFull, resPrivateFull, resTeaser] = await Promise.all([
            cleaningFullPublic.search(expandedPublicFull),
            cleaningFullPrivate.search(expandedPrivateFull),
            cleaningTeaser?.search(expandedTeaser) ?? Promise.resolve({ results: [] })
          ]);
          const merged = [] as any[];
          for (let i = 0, jPub = 0, jPriv = 0, jTeaser = 0; i < (requests || []).length; i++) {
            const originalParams = (requests || [])[i]?.params || {};
            const origin = frozenOrigin;
            if (origin === 'public') {
              const publicFull = resPublicFull.results[jPub] as SearchResponse<any>; jPub++;
              const publicTeaser = (resTeaser as any).results?.[jTeaser] as SearchResponse<any>; jTeaser++;
              merged.push(mergeFederatedPair(publicFull, publicTeaser));
            } else if (origin === 'private') {
              const privateRes = resPrivateFull.results[jPriv]; jPriv += 1;
              merged.push(privateRes);
            } else {
              const publicFull = resPublicFull.results[jPub] as SearchResponse<any>; jPub++;
              const publicTeaser = (resTeaser as any).results?.[jTeaser] as SearchResponse<any>; jTeaser++;
              const mergedPublic = mergeFederatedPair(publicFull, publicTeaser);
              const privateResult = resPrivateFull.results[jPriv] as SearchResponse<any>; jPriv++;
              merged.push(mergeFederatedPair(mergedPublic, privateResult, { sumNbHits: true }));
            }
          }
          if (DEBUG_MULTI_INDEX) debug('merged results stats', merged?.map((r: any) => ({ nbHits: r?.nbHits })));
          return { results: merged };
        } catch (error) {
          if (DEBUG_MULTI_INDEX) console.error('[FavorisProvider] search error', error);
          const emptyRes: any = { hits: [], nbHits: 0, nbPages: 0, page: 0, processingTimeMS: 0, facets: {}, facets_stats: null, query: '', params: '' };
          return { results: (requests || []).map(() => emptyRes) };
        }
      }
    };
  }

  const searchClient = clients ? searchClientRef.current : null;
  if (!searchClient) return null;

  const RefreshOnFavoriteIdsChange: React.FC<{ favoriteIds: string[] }> = ({ favoriteIds }) => {
    const { refresh } = useInstantSearch();
    const lastRef = useRef<string[] | null>(null);
    useEffect(() => {
      if (lastRef.current !== favoriteIds) {
        // Mettre à jour la ref utilisée par le search client avant de rafraîchir
        favoriteIdsRef.current = favoriteIds;
        lastRef.current = favoriteIds;
        refresh();
      }
    }, [favoriteIds, refresh]);
    return null;
  };

  return (
    <FavorisQuotaContext.Provider value={quotaHook}>
      <InstantSearch searchClient={searchClient as any} indexName={INDEX_ALL} future={{ preserveSharedStateOnUnmount: true }}>
        <RefreshOnFavoriteIdsChange favoriteIds={favoriteIds} />
        {children}
      </InstantSearch>
    </FavorisQuotaContext.Provider>
  );
};