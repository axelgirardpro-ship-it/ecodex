import { useState, useEffect } from "react";
import { liteClient as algoliasearch } from "algoliasearch/lite";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const ALGOLIA_APPLICATION_ID = import.meta.env.VITE_ALGOLIA_APPLICATION_ID || '6BGAS85TYS';
const ALGOLIA_SEARCH_API_KEY = import.meta.env.VITE_ALGOLIA_SEARCH_API_KEY || 'e06b7614aaff866708fbd2872de90d37';

const algoliaClient = algoliasearch(ALGOLIA_APPLICATION_ID, ALGOLIA_SEARCH_API_KEY);

export const useSuggestions = (searchQuery: string) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  // Fetch suggestions from Algolia emission_factors index
  const fetchSuggestions = async (query: string) => {
    if (!query.trim()) return [];

    try {
      const { results } = await algoliaClient.search([
        {
          indexName: "emission_factors",
          query,
          params: {
            hitsPerPage: 5,
            attributesToRetrieve: ["Nom"],
            restrictSearchableAttributes: ["Nom", "Description", "Secteur"],
          },
        },
      ]);
      
      const hits = (results?.[0]?.hits || []) as Array<{ Nom?: string }>;
      const names = hits.map((h) => h.Nom).filter((v): v is string => Boolean(v));
      return Array.from(new Set(names)).slice(0, 5);
    } catch (error) {
      console.error('Error fetching suggestions from Algolia:', error);
      return [];
    }
  };

  // Fetch recent searches from search_history
  const fetchRecentSearches = async () => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('search_history')
        .select('search_query')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Get unique search queries (last 5)
      const uniqueSearches = [...new Set(data?.map(item => item.search_query) || [])];
      return uniqueSearches.slice(0, 3);
    } catch (error) {
      console.error('Error fetching recent searches:', error);
      return [];
    }
  };

  // Debounced suggestions fetch
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    const timeoutId = setTimeout(async () => {
      const newSuggestions = await fetchSuggestions(searchQuery);
      setSuggestions(newSuggestions as string[]);
      setLoading(false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Fetch recent searches on mount
  useEffect(() => {
    const loadRecentSearches = async () => {
      const searches = await fetchRecentSearches();
      setRecentSearches(searches);
    };

    if (user) {
      loadRecentSearches();
    }
  }, [user]);

  return {
    suggestions,
    recentSearches,
    loading
  };
};