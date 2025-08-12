import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";

export const useSearchHistory = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const recordSearch = useCallback(async (
    searchQuery: string, 
    filters: any, 
    resultsCount: number
  ) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('search_history')
        .insert({
          user_id: user.id,
          workspace_id: currentWorkspace?.id,
          search_query: searchQuery,
          search_filters: filters,
          results_count: resultsCount
        });

      if (error) {
        console.error('Error recording search history:', error);
      }
    } catch (error) {
      console.error('Error recording search history:', error);
    }
  }, [user, currentWorkspace]);

  const getRecentSearches = useCallback(async () => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('search_history')
        .select('search_query')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Return unique search queries (last 5)
      const uniqueSearches = [...new Set(data?.map(item => item.search_query) || [])];
      return uniqueSearches.slice(0, 3);
    } catch (error) {
      console.error('Error fetching recent searches:', error);
      return [];
    }
  }, [user]);

  return { recordSearch, getRecentSearches };
};