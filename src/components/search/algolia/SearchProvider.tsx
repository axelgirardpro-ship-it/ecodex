import React, { createContext, useContext, useMemo, useEffect, useState, useRef } from 'react';
import { InstantSearch } from 'react-instantsearch';
import { supabase } from '@/integrations/supabase/client';
import { useQuotas } from '@/hooks/useQuotas';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { INDEX_ALL } from '@/config/search';
import { type Origin } from '@/lib/algolia/searchClient';
import { useEmissionFactorAccess } from '@/hooks/useEmissionFactorAccess';
import { DEBUG_MULTI_INDEX } from '@/config/featureFlags';
import { createUnifiedClient } from '@/lib/algolia/unifiedSearchClient';
import { performanceMonitor } from '@/lib/algolia/performanceMonitor';
import { useAuth } from '@/contexts/AuthContext';
import AlgoliaErrorBoundary from '@/components/search/AlgoliaErrorBoundary';
import DebugSearchState from '@/components/search/DebugSearchState';
import { resolveOrigin } from '@/lib/algolia/searchClient';

function useOptimizedAlgoliaClient(workspaceId?: string, assignedSources: string[] = []) {
  const [client, setClient] = useState<any>(null);
  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!cancelled) {
        const unifiedClient = createUnifiedClient(workspaceId, assignedSources);
        setClient(unifiedClient);
      }
    }
    init();
    return () => { 
      cancelled = true;
      if (client) {
        client.dispose();
      }
    };
  }, [workspaceId, JSON.stringify(assignedSources)]);
  return client;
}

// Le nettoyage des paramètres est géré par UnifiedSearchClient

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

// Contrôles de recherche (override Enter)
export const SearchControlContext = createContext<{ forceNextSearch: () => void } | null>(null);
export const useSearchControls = () => {
  const ctx = useContext(SearchControlContext);
  if (!ctx) throw new Error('useSearchControls must be used within SearchProvider');
  return ctx;
};

// Provider autonome d'origine (sans InstantSearch). Utile pour /favoris
export const OriginProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [origin, setOrigin] = useState<Origin>('public');
  return (
    <OriginContext.Provider value={{ origin, setOrigin }}>
      {children}
    </OriginContext.Provider>
  );
};

interface SearchProviderProps { children: React.ReactNode; }

export const SearchProvider: React.FC<SearchProviderProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const quotaHook = useQuotas();
  const { currentWorkspace } = useWorkspace();
  const { assignedSources } = useEmissionFactorAccess();
  const unifiedClient = useOptimizedAlgoliaClient(currentWorkspace?.id, assignedSources);
  const [origin, setOrigin] = useState<Origin>('public');
  const originRef = useRef<Origin>('public');
  useEffect(() => { originRef.current = origin; }, [origin]);
  const workspaceIdRef = useRef<string | undefined>(currentWorkspace?.id);
  useEffect(() => { workspaceIdRef.current = currentWorkspace?.id; }, [currentWorkspace?.id]);

  // Forçage temporaire (< 3 chars) avec fenêtre temporelle pour éviter les courses
  const forceUntilTsRef = useRef<number>(0);
  const controlsValue = useMemo(() => ({
    forceNextSearch: () => { forceUntilTsRef.current = Date.now() + 1000; }
  }), []);
  // Exposer un fallback global en runtime pour les composants non-contextualisés (sécurité)
  if (typeof window !== 'undefined') {
    (window as any).algoliaSearchControls = controlsValue;
  }

  // (Rollback) Ne pas persister l'état UI pour éviter toute incompatibilité de widgets

  // Client de recherche optimisé avec monitoring
  const searchClientRef = useRef<any>(null);
  // Gestion du teaser différé: activé après un court délai d'inactivité sur la requête
  const teaserAllowedRef = useRef<boolean>(false);
  const lastQueryRef = useRef<string>('');
  const teaserTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  if (unifiedClient && !searchClientRef.current) {
    searchClientRef.current = {
      search: async (requests: any[]) => {
        const startTime = Date.now();
        let success = true;
        
        try {
          if (DEBUG_MULTI_INDEX) {
            console.log('[OptimizedSearchProvider] incoming requests', requests?.length);
          }

          // Enrichir chaque requête avec une origine dérivée des ruleContexts (fallback sur la ref)
          const enrichedRequests = requests.map(r => {
            const baseParams = r?.params || {};
            const computedOrigin = resolveOrigin(baseParams) || originRef.current;
            return {
              ...r,
              origin: computedOrigin,
              params: {
                ...baseParams,
                // Ajouter des métadonnées pour le monitoring
                _search_context: {
                  workspace_id: workspaceIdRef.current,
                  origin: computedOrigin,
                  timestamp: Date.now()
                }
              }
            };
          });

          // Teaser différé: autoriser le teaser seulement après un délai d'inactivité sur la requête
          const q = enrichedRequests?.[0]?.params?.query ?? '';
          if ((q || '') !== (lastQueryRef.current || '')) {
            lastQueryRef.current = q;
            teaserAllowedRef.current = false;
            if (teaserTimerRef.current) clearTimeout(teaserTimerRef.current);
            teaserTimerRef.current = setTimeout(() => {
              teaserAllowedRef.current = true;
            }, 400);
          }

          const result = await unifiedClient.search(enrichedRequests, {
            enableCache: true,
            enableDeduplication: true,
            enableBatching: true,
            teaserAllowed: teaserAllowedRef.current
          });

          return result;
        } catch (error) {
          success = false;
          if (DEBUG_MULTI_INDEX) console.error('[OptimizedSearchProvider] search error', error);
          
          // Retourner des résultats vides en cas d'erreur
          const emptyRes: any = { 
            hits: [], 
            nbHits: 0, 
            nbPages: 0, 
            page: 0, 
            processingTimeMS: 0, 
            facets: {}, 
            facets_stats: null, 
            query: '', 
            params: '' 
          };
          return { results: (requests || []).map(() => emptyRes) };
        } finally {
          // Enregistrer les métriques de performance
          const responseTime = Date.now() - startTime;
          performanceMonitor.recordRequest(
            responseTime,
            success,
            workspaceIdRef.current, // userId approximatif
            requests?.[0]?.params?.query || '',
            false // pas depuis le cache ici, le cache est géré dans unifiedClient
          );
        }
      }
    };
  }

  const searchClient = unifiedClient ? searchClientRef.current : null;

  return (
    <AlgoliaErrorBoundary>
      <QuotaContext.Provider value={quotaHook}>
        <OriginContext.Provider value={{ origin, setOrigin }}>
          <SearchControlContext.Provider value={controlsValue}>
            {authLoading || !user || !searchClient ? (
              // Rendre le container pour éviter le flash, mais pas de fallback UI legacy
              <div />
            ) : (
              <InstantSearch searchClient={searchClient as any} indexName={INDEX_ALL} future={{ preserveSharedStateOnUnmount: true }}>
                {children}
                <DebugSearchState />
              </InstantSearch>
            )}
          </SearchControlContext.Provider>
        </OriginContext.Provider>
      </QuotaContext.Provider>
    </AlgoliaErrorBoundary>
  );
};