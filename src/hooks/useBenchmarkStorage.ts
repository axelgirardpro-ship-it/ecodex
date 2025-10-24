import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { queryKeys } from '@/lib/queryKeys';
import type {
  SavedBenchmark,
  BenchmarkHistoryItem,
  BenchmarkData,
} from '@/types/benchmark';

export const useBenchmarkStorage = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const queryClient = useQueryClient();

  // Récupérer l'historique des benchmarks (50 derniers)
  const {
    data: history,
    isLoading: isLoadingHistory,
    error: historyError,
  } = useQuery({
    queryKey: queryKeys.benchmark.list(currentWorkspace?.id || ''),
    queryFn: async () => {
      if (!currentWorkspace) return [];

      const { data, error } = await supabase
        .from('benchmarks')
        .select('id, title, created_at, sample_size, unit')
        .eq('workspace_id', currentWorkspace.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return data as BenchmarkHistoryItem[];
    },
    enabled: !!currentWorkspace?.id,
    staleTime: 60000, // 1 minute
  });

  // Charger un benchmark spécifique par ID
  const loadBenchmark = async (id: string): Promise<SavedBenchmark | null> => {
    const { data, error } = await supabase
      .from('benchmarks')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data as SavedBenchmark;
  };

  // Hook pour charger un benchmark par ID avec cache
  const useBenchmarkDetail = (id: string | undefined) => {
    return useQuery({
      queryKey: queryKeys.benchmark.detail(id || ''),
      queryFn: () => loadBenchmark(id!),
      enabled: !!id,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  };

  // Sauvegarder un nouveau benchmark
  const saveBenchmarkMutation = useMutation({
    mutationFn: async (params: {
      title: string;
      description?: string;
      benchmarkData: BenchmarkData;
      searchParams: {
        query: string;
        filters?: Record<string, string[]>;
        facetFilters?: string[][];
      };
    }) => {
      if (!user || !currentWorkspace) {
        throw new Error('User or workspace not found');
      }

      const { data, error } = await supabase
        .from('benchmarks')
        .insert({
          workspace_id: currentWorkspace.id,
          created_by: user.id,
          search_query: params.searchParams.query,
          search_filters: params.searchParams.filters || null,
          facet_filters: params.searchParams.facetFilters || null,
          title: params.title,
          description: params.description || null,
          unit: params.benchmarkData.metadata.unit,
          scope: params.benchmarkData.metadata.scope,
          sample_size: params.benchmarkData.statistics.sampleSize,
          sources: params.benchmarkData.metadata.sources,
          statistics: params.benchmarkData.statistics,
          chart_data: params.benchmarkData.chartData,
          top10: params.benchmarkData.top10,
          worst10: params.benchmarkData.worst10,
          metadata: params.benchmarkData.metadata,
        })
        .select()
        .single();

      if (error) throw error;

      return data as SavedBenchmark;
    },
    onSuccess: () => {
      // Invalider l'historique pour forcer un refresh
      queryClient.invalidateQueries({
        queryKey: queryKeys.benchmark.list(currentWorkspace?.id || ''),
      });
    },
  });

  // Supprimer un benchmark (soft delete)
  const deleteBenchmarkMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('benchmarks')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      // Invalider l'historique
      queryClient.invalidateQueries({
        queryKey: queryKeys.benchmark.list(currentWorkspace?.id || ''),
      });
    },
  });

  // Mettre à jour un benchmark
  const updateBenchmarkMutation = useMutation({
    mutationFn: async (params: {
      id: string;
      title?: string;
      description?: string;
    }) => {
      const { error } = await supabase
        .from('benchmarks')
        .update({
          title: params.title,
          description: params.description,
        })
        .eq('id', params.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      // Invalider le détail du benchmark
      queryClient.invalidateQueries({
        queryKey: queryKeys.benchmark.detail(variables.id),
      });
      // Invalider l'historique
      queryClient.invalidateQueries({
        queryKey: queryKeys.benchmark.list(currentWorkspace?.id || ''),
      });
    },
  });

  return {
    // History
    history,
    isLoadingHistory,
    historyError,
    
    // Detail loader hook
    useBenchmarkDetail,
    
    // Mutations
    saveBenchmark: saveBenchmarkMutation.mutateAsync,
    isSaving: saveBenchmarkMutation.isLoading,
    saveError: saveBenchmarkMutation.error,
    
    deleteBenchmark: deleteBenchmarkMutation.mutateAsync,
    isDeleting: deleteBenchmarkMutation.isLoading,
    deleteError: deleteBenchmarkMutation.error,
    
    updateBenchmark: updateBenchmarkMutation.mutateAsync,
    isUpdating: updateBenchmarkMutation.isLoading,
    updateError: updateBenchmarkMutation.error,
  };
};

