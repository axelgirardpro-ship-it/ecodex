import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export const useSuggestions = (searchQuery: string) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  // Fetch suggestions from emission_factors based on search query
  const fetchSuggestions = async (query: string) => {
    if (!query.trim() || !currentWorkspace) return [];

    try {
      const { data, error } = await supabase
        .from('emission_factors')
        .select('"Nom"')
        .or(`"Nom".ilike.%${query}%,"Description".ilike.%${query}%,"Secteur".ilike.%${query}%`)
        .limit(5);

      if (error) throw error;

      // Get unique suggestions
      const uniqueNames = [...new Set(data?.map(item => item["Nom"]) || [])];
      return uniqueNames.slice(0, 5);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
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
  }, [searchQuery, currentWorkspace]);

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