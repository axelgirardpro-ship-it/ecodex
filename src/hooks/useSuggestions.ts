import { useState, useEffect } from "react";
import { liteClient as algoliasearch, SearchResponse } from "algoliasearch/lite";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

const ALGOLIA_APPLICATION_ID = import.meta.env.VITE_ALGOLIA_APPLICATION_ID || '6BGAS85TYS';
const ALGOLIA_SEARCH_API_KEY = import.meta.env.VITE_ALGOLIA_SEARCH_API_KEY || 'e06b7614aaff866708fbd2872de90d37';

const algoliaClient = algoliasearch(ALGOLIA_APPLICATION_ID, ALGOLIA_SEARCH_API_KEY);

type HitMinimal = { Nom?: string };

type MultiSearchResults = {
  results: [SearchResponse<HitMinimal>, SearchResponse<HitMinimal>];
};

export type SuggestionItem = { label: string; isPrivate: boolean };

export const useSuggestions = (searchQuery: string) => {
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const fetchSuggestions = async (query: string) => {
    if (!query.trim()) return [] as SuggestionItem[];

    const wsId = currentWorkspace?.id;
    const publicFilters = (() => {
      const base = '(access_level:standard) OR (is_blurred:true)';
      const ws = wsId ? ` OR (assigned_workspace_ids:${wsId})` : '';
      return base + ws;
    })();
    const privateFilters = wsId ? `workspace_id:${wsId}` : 'workspace_id:_none_';

    try {
      const { results } = (await algoliaClient.search([
        {
          indexName: "ef_public_fr",
          query,
          params: {
            hitsPerPage: 5,
            attributesToRetrieve: ["Nom"],
            restrictSearchableAttributes: ["Nom", "Description", "Secteur"],
            filters: publicFilters
          },
        },
        {
          indexName: "ef_private_fr",
          query,
          params: {
            hitsPerPage: 5,
            attributesToRetrieve: ["Nom"],
            restrictSearchableAttributes: ["Nom", "Description", "Secteur"],
            filters: privateFilters
          },
        }
      ] as any)) as MultiSearchResults;

      const hitsPublic = results[0]?.hits || [];
      const hitsPrivate = results[1]?.hits || [];

      // Construire une map Nom -> isPrivate
      const map = new Map<string, boolean>();
      for (const h of hitsPublic) {
        if (h?.Nom) map.set(h.Nom, false);
      }
      for (const h of hitsPrivate) {
        if (h?.Nom) map.set(h.Nom, true); // si présent en privé, on force isPrivate=true
      }

      const items: SuggestionItem[] = Array.from(map.entries())
        .slice(0, 5)
        .map(([label, isPrivate]) => ({ label, isPrivate }));

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
      const newSuggestions = await fetchSuggestions(searchQuery);
      setSuggestions(newSuggestions as SuggestionItem[]);
      setLoading(false);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, currentWorkspace?.id]);

  useEffect(() => {
    const loadRecentSearches = async () => {
      const searches = await fetchRecentSearches();
      setRecentSearches(searches);
    };
    if (user) loadRecentSearches();
  }, [user]);

  return { suggestions, recentSearches, loading };
};
