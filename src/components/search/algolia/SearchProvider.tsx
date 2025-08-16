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

const FALLBACK_APP_ID = import.meta.env.VITE_ALGOLIA_APPLICATION_ID || '6BGAS85TYS';
const FALLBACK_SEARCH_KEY = import.meta.env.VITE_ALGOLIA_SEARCH_API_KEY || 'e06b7614aaff866708fbd2872de90d37';

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

// Le nettoyage des paramètres est maintenant géré par UnifiedSearchClient
// Cette fonction est conservée pour compatibilité mais n'est plus utilisée
const cleaningWrapper = (rawSearchClient: any) => rawSearchClient;

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
  const unifiedClient = useOptimizedAlgoliaClient(currentWorkspace?.id, assignedSources);
  const [origin, setOrigin] = useState<Origin>('all');
  const originRef = useRef<Origin>('all');
  useEffect(() => { originRef.current = origin; }, [origin]);
  const workspaceIdRef = useRef<string | undefined>(currentWorkspace?.id);
  useEffect(() => { workspaceIdRef.current = currentWorkspace?.id; }, [currentWorkspace?.id]);

  // Client de recherche optimisé avec monitoring
  const searchClientRef = useRef<any>(null);
  if (unifiedClient && !searchClientRef.current) {
    searchClientRef.current = {
      search: async (requests: any[]) => {
        const startTime = Date.now();
        let success = true;
        
        try {
          if (DEBUG_MULTI_INDEX) {
            console.log('[OptimizedSearchProvider] incoming requests', requests?.length);
          }

          // Enrichir les requêtes avec l'origine actuelle
          const enrichedRequests = requests.map(r => ({
            ...r,
            origin: originRef.current,
            params: {
              ...r.params,
              // Ajouter des métadonnées pour le monitoring
              _search_context: {
                workspace_id: workspaceIdRef.current,
                origin: originRef.current,
                timestamp: Date.now()
              }
            }
          }));

          const result = await unifiedClient.search(enrichedRequests, {
            enableCache: true,
            enableDeduplication: true,
            enableBatching: true
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