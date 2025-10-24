import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { queryKeys } from '@/lib/queryKeys';
import type { BenchmarkRequest, BenchmarkData } from '@/types/benchmark';

// URL Supabase (hardcodée comme dans client.ts)
const SUPABASE_URL = 'https://wrodvaatdujbpfpvrzge.supabase.co';

// Générer un hash simple pour la clé de cache
// Version 2: retourne tous les points (pas juste 24)
const generateQueryHash = (query: string, filters: Record<string, unknown>, facetFilters: unknown): string => {
  const str = JSON.stringify({ query, filters, facetFilters, v: 2 });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
};

export const useBenchmarkGeneration = (
  query: string,
  filters?: Record<string, string[]>,
  facetFilters?: string[][],
  options?: {
    enabled?: boolean;
    onSuccess?: (data: BenchmarkData) => void;
    onError?: (error: Error) => void;
  }
) => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  const queryHash = generateQueryHash(query, filters, facetFilters);

  const generateBenchmark = async (): Promise<BenchmarkData> => {
    if (!user || !currentWorkspace) {
      throw new Error('User or workspace not found');
    }

    const requestBody: BenchmarkRequest = {
      query,
      filters,
      facetFilters,
      workspaceId: currentWorkspace.id,
      userId: user.id,
    };

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('No active session');
    }

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/generate-benchmark`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || errorData.error || 'Failed to generate benchmark');
    }

    const data = await response.json();
    return data as BenchmarkData;
  };

  // Vérifier si on a une query OU des filtres
  const hasQuery = query && query.trim().length > 0;
  const hasFilters = (filters && Object.keys(filters).length > 0) || 
    (facetFilters && facetFilters.length > 0);
  const hasQueryOrFilters = hasQuery || hasFilters;

  // Utiliser useQuery pour le cache automatique
  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [...queryKeys.benchmark.generate(queryHash), currentWorkspace?.id],
    queryFn: generateBenchmark,
    enabled: options?.enabled !== false && !!user && !!currentWorkspace && hasQueryOrFilters,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });

  return {
    data,
    isLoading,
    error: error as Error | null,
    refetch,
  };
};

// Mutation pour forcer une nouvelle génération (bypass cache)
export const useBenchmarkGenerationMutation = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (params: {
      query: string;
      filters?: Record<string, string[]>;
      facetFilters?: string[][];
    }) => {
      if (!user || !currentWorkspace) {
        throw new Error('User or workspace not found');
      }

      const requestBody: BenchmarkRequest = {
        query: params.query,
        filters: params.filters,
        facetFilters: params.facetFilters,
        workspaceId: currentWorkspace.id,
        userId: user.id,
      };

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/generate-benchmark`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || 'Failed to generate benchmark');
      }

      const data = await response.json();
      return data as BenchmarkData;
    },
  });
};

