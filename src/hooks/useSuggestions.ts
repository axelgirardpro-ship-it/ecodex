import { useState, useEffect, useRef } from "react";
import { liteClient as algoliasearch, SearchResponse } from "algoliasearch/lite";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useOrigin } from "@/components/search/algolia/SearchProvider";
import { USE_SECURED_KEYS } from "@/config/featureFlags";

const FALLBACK_APP_ID = import.meta.env.VITE_ALGOLIA_APPLICATION_ID || '6BGAS85TYS';
const FALLBACK_SEARCH_API_KEY = import.meta.env.VITE_ALGOLIA_SEARCH_API_KEY || 'e06b7614aaff866708fbd2872de90d37';

type HitMinimal = { Nom_fr?: string; Nom_en?: string };

type MultiSearchResults = {
  results: SearchResponse<HitMinimal>[];
};

export type SuggestionItem = { label: string; isPrivate: boolean };

export const useSuggestions = (searchQuery: string) => {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { origin } = useOrigin();
  const debug = (...args: any[]) => { if (import.meta.env.DEV) console.log('[useSuggestions]', ...args); };

  // Clients sécurisés (public/private) pour les suggestions
  const clientsRef = useRef<{ public: any; private: any } | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function init() {
      const isLocalhost = typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
      if (isLocalhost) {
        if (!cancelled) {
          clientsRef.current = {
            public: algoliasearch(FALLBACK_APP_ID, FALLBACK_SEARCH_API_KEY),
            private: algoliasearch(FALLBACK_APP_ID, FALLBACK_SEARCH_API_KEY)
          };
        }
        return;
      }
      if (USE_SECURED_KEYS) {
        try {
          const wsId = currentWorkspace?.id;
          const qs = wsId ? `?workspaceId=${encodeURIComponent(wsId)}` : '';
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token || '';
          const res = await fetch(`/functions/v1/algolia-secure-key${qs}`, { headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) {
            const payload = await res.json();
            if (!cancelled) {
              clientsRef.current = {
                public: algoliasearch(payload.appId, payload.fullPublic?.searchApiKey || payload.full?.searchApiKey),
                private: algoliasearch(payload.appId, payload.fullPrivate?.searchApiKey || payload.full?.searchApiKey)
              };
            }
            return;
          }
        } catch (e) {
          if (import.meta.env.DEV) console.warn('[useSuggestions] secure key fetch failed', e);
        }
      }
      if (!cancelled && import.meta.env.DEV) {
        clientsRef.current = {
          public: algoliasearch(FALLBACK_APP_ID, FALLBACK_SEARCH_API_KEY),
          private: algoliasearch(FALLBACK_APP_ID, FALLBACK_SEARCH_API_KEY)
        };
      }
    }
    init();
    return () => { cancelled = true; };
  }, [currentWorkspace?.id]);

  const fetchSuggestions = async (query: string) => {
    if (!query.trim()) return [] as SuggestionItem[];

    const wsId = currentWorkspace?.id;
    const publicFilters = (() => {
      const base = '(access_level:standard)';
      const ws = wsId ? ` OR (assigned_workspace_ids:${wsId})` : '';
      return base + ws;
    })();
    const privateFilters = wsId ? `workspace_id:${wsId}` : 'workspace_id:_none_';

    try {
      const requests: any[] = [];
      if (origin === 'all' || origin === 'public') {
        requests.push({
          indexName: 'ef_all',
          query,
          params: {
            hitsPerPage: 5,
            attributesToRetrieve: ['Nom_fr','Nom_en'],
            restrictSearchableAttributes: ['Nom_fr','Nom_en','Description_fr','Description_en','Secteur_fr','Secteur_en'],
            facetFilters: [["scope:public"]],
            filters: publicFilters,
          },
        });
      }
      if (origin === 'all' || origin === 'private') {
        requests.push({
          indexName: 'ef_all',
          query,
          params: {
            hitsPerPage: 5,
            attributesToRetrieve: ['Nom_fr','Nom_en'],
            restrictSearchableAttributes: ['Nom_fr','Nom_en','Description_fr','Description_en','Secteur_fr','Secteur_en'],
            facetFilters: [["scope:private"]],
            filters: privateFilters,
          },
        });
      }

      debug('query', { origin, query, wsId, publicFilters, privateFilters, requests });
      const clients = clientsRef.current;
      if (!clients) return [] as SuggestionItem[];
      // Public et privé doivent être cherché avec les clients correspondants
      const resPublic = (origin === 'private') ? { results: [] } as any : await clients.public.search([requests[0]].filter(Boolean));
      const resPrivate = (origin === 'public') ? { results: [] } as any : await clients.private.search([requests[origin==='all' ? 1 : 0]].filter(Boolean));

      const hitsPublic = (origin === 'private') ? [] : ((resPublic?.results?.[0]?.hits || []) as SearchResponse<HitMinimal>["hits"]);
      const hitsPrivate = (origin === 'public') ? [] : ((resPrivate?.results?.[0]?.hits || []) as SearchResponse<HitMinimal>["hits"]);

      const map = new Map<string, boolean>();
      const labelFrom = (h: HitMinimal) => h.Nom_fr || h.Nom_en || '';
      for (const h of hitsPublic) {
        const label = labelFrom(h);
        if (label) map.set(label, false);
      }
      for (const h of hitsPrivate) {
        const label = labelFrom(h);
        if (label) map.set(label, true);
      }

      const items: SuggestionItem[] = Array.from(map.entries())
        .slice(0, 5)
        .map(([label, isPrivate]) => ({ label, isPrivate }));

      debug('results', { hitsPublic: hitsPublic.length, hitsPrivate: hitsPrivate.length, items });
      return items;
    } catch (error) {
      console.error('Error fetching suggestions from Algolia:', error);
      return [] as SuggestionItem[];
    }
  };

  const fetchRecentSearches = async () => {
    if (!user) return [] as string[];
    try {
      const { data, error } = await supabase
        .from('search_history')
        .select('search_query')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      const uniqueSearches = [...new Set(data?.map(item => item.search_query) || [])];
      return uniqueSearches.slice(0, 3);
    } catch (error) {
      console.error('Error fetching recent searches:', error);
      return [] as string[];
    }
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    const timeoutId = setTimeout(async () => {
      debug('fetchSuggestions start', { origin, searchQuery });
      const newSuggestions = await fetchSuggestions(searchQuery);
      setSuggestions(newSuggestions as SuggestionItem[]);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, currentWorkspace?.id, origin]);

  useEffect(() => {
    const loadRecentSearches = async () => {
      const searches = await fetchRecentSearches();
      setRecentSearches(searches);
    };
    if (user) loadRecentSearches();
  }, [user]);

  return { suggestions, recentSearches, loading };
};
