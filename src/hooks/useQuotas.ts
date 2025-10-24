import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { useQuotaSync, type PlanType } from "@/hooks/useQuotaSync";
import { useQuotaRealtime } from "@/hooks/useOptimizedRealtime";
import { queryKeys } from '@/lib/queryKeys';

interface QuotaData {
  user_id: string;
  plan_type?: PlanType; // optionnel, non stocké dans search_quotas
  exports_limit: number | null; // null = unlimited
  clipboard_copies_limit: number | null; // null = unlimited
  favorites_limit: number | null; // null = unlimited
  exports_used: number;
  clipboard_copies_used: number;
  favorites_used: number;
  // Benchmarks (nouveau)
  benchmarks_limit: number | null; // null = unlimited (Pro), 3 = Freemium
  benchmarks_used: number;
  benchmarks_reset_date: string | null;
}

// Fonction de fetch isolée pour React Query
const fetchQuotaData = async (userId: string): Promise<QuotaData | null> => {
  const { data, error } = await supabase
    .from('search_quotas')
    .select('*')
    .eq('user_id', userId)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error;
  
  // Si aucun quota n'existe, en créer un par défaut
  if (!data) {
    const { data: newQuota, error: insertError } = await supabase
      .from('search_quotas')
      .insert({
        user_id: userId,
        exports_limit: 0,
        clipboard_copies_limit: 10,
        favorites_limit: 10,
        exports_used: 0,
        clipboard_copies_used: 0,
        favorites_used: 0
      })
      .select()
      .single();
    
    if (insertError) throw insertError;
    return newQuota as QuotaData;
  }
  
  return data as QuotaData;
};

export const useQuotas = () => {
  const { user } = useAuth();
  const { planType: effectivePlanType } = usePermissions();
  const queryClient = useQueryClient();
  
  // React Query pour le fetch (sans sync - géré au niveau App)
  const { data: quotaData, isLoading, error: queryError } = useQuery({
    queryKey: queryKeys.quotas.user(user?.id || ''),
    queryFn: async () => {
      if (!user) return null;
      // Pas de sync ici - géré au niveau AuthContext/App pour éviter les doublons
      return fetchQuotaData(user.id);
    },
    enabled: !!user?.id,
    staleTime: 60000, // Augmenté à 60s pour réduire les refetch
    gcTime: 10 * 60000, // Augmenté à 10 min
  });

  // Callback optimisé pour Realtime (synchronise React Query cache)
  const handleQuotaUpdate = useCallback((payload: Record<string, unknown>) => {
    if (payload.eventType === 'UPDATE' && payload.new && payload.new.user_id === user?.id) {
      queryClient.setQueryData(
        queryKeys.quotas.user(user.id),
        payload.new as QuotaData
      );
    }
  }, [user?.id, queryClient]);

  // Subscription Realtime DÉSACTIVÉE temporairement
  // React Query gère les mises à jour via refetch automatique
  // Réactiver quand la configuration Supabase Realtime sera corrigée
  // useQuotaRealtime(user?.id, handleQuotaUpdate);

  // Injecter plan_type depuis les permissions
  const enrichedQuotaData = useMemo(() => {
    if (!quotaData) return null;
    return { ...quotaData, plan_type: effectivePlanType as "freemium" | "starter" | "pro" | "enterprise" };
  }, [quotaData, effectivePlanType]);



  // Logique simplifiée et cohérente pour les quotas (recherches illimitées)
  const canExport = enrichedQuotaData ? 
    enrichedQuotaData.exports_limit === null || enrichedQuotaData.exports_used < enrichedQuotaData.exports_limit 
    : false;
  
  // Vérifications pour les nouvelles limites
  const canCopyToClipboard = enrichedQuotaData ? 
    enrichedQuotaData.clipboard_copies_limit === null || enrichedQuotaData.clipboard_copies_used < enrichedQuotaData.clipboard_copies_limit 
    : false;
  const canAddToFavorites = enrichedQuotaData ? 
    enrichedQuotaData.favorites_limit === null || enrichedQuotaData.favorites_used < enrichedQuotaData.favorites_limit 
    : false;
  
  const canGenerateBenchmark = enrichedQuotaData ?
    enrichedQuotaData.benchmarks_limit === null || enrichedQuotaData.benchmarks_used < enrichedQuotaData.benchmarks_limit
    : false;
  
  // Un utilisateur est "à la limite" s'il ne peut plus faire d'actions principales
  const isAtLimit = enrichedQuotaData ? 
    !canExport || !canCopyToClipboard || !canAddToFavorites
    : false;
  
  const incrementExport = useCallback(async (count: number = 1) => {
    if (!user || !enrichedQuotaData) return;
    
    // Ne pas incrémenter si les exports sont illimités (Pro)
    if (enrichedQuotaData.exports_limit === null) {
      return;
    }
    
    const { error } = await supabase
      .from('search_quotas')
      .update({ exports_used: enrichedQuotaData.exports_used + count })
      .eq('user_id', user.id);
    
    if (error) {
      throw error;
    }
    
    // Mettre à jour le cache React Query
    queryClient.setQueryData(
      queryKeys.quotas.user(user.id),
      (old: QuotaData | null | undefined) => 
        old ? { ...old, exports_used: old.exports_used + count } : null
    );
  }, [user, enrichedQuotaData, queryClient]);
  
  const incrementClipboardCopy = useCallback(async (count: number = 1) => {
    if (!user || !enrichedQuotaData) return;
    
    // Ne pas incrémenter si les copies sont illimitées (Pro)
    if (enrichedQuotaData.clipboard_copies_limit === null) {
      return;
    }
    
    const { error } = await supabase
      .from('search_quotas')
      .update({ clipboard_copies_used: enrichedQuotaData.clipboard_copies_used + count })
      .eq('user_id', user.id);
    
    if (error) {
      throw error;
    }
    
    // Mettre à jour le cache React Query
    queryClient.setQueryData(
      queryKeys.quotas.user(user.id),
      (old: QuotaData | null | undefined) => 
        old ? { ...old, clipboard_copies_used: old.clipboard_copies_used + count } : null
    );
  }, [user, enrichedQuotaData, queryClient]);
  
  const incrementFavorite = useCallback(async () => {
    if (!user || !enrichedQuotaData) return;
    
    // Ne pas incrémenter si les favoris sont illimités (Premium)
    if (enrichedQuotaData.favorites_limit === null) {
      return;
    }
    
    const { error } = await supabase
      .from('search_quotas')
      .update({ favorites_used: enrichedQuotaData.favorites_used + 1 })
      .eq('user_id', user.id);
    
    if (error) {
      throw error;
    }
    
    // Mettre à jour le cache React Query
    queryClient.setQueryData(
      queryKeys.quotas.user(user.id),
      (old: QuotaData | null | undefined) => 
        old ? { ...old, favorites_used: old.favorites_used + 1 } : null
    );
  }, [user, enrichedQuotaData, queryClient]);

  const incrementBenchmark = useCallback(async () => {
    if (!user || !enrichedQuotaData) return;
    
    // Ne pas incrémenter si les benchmarks sont illimités (Pro)
    if (enrichedQuotaData.benchmarks_limit === null) {
      return;
    }
    
    const { error } = await supabase
      .from('search_quotas')
      .update({ benchmarks_used: enrichedQuotaData.benchmarks_used + 1 })
      .eq('user_id', user.id);
    
    if (error) {
      throw error;
    }
    
    // Mettre à jour le cache React Query
    queryClient.setQueryData(
      queryKeys.quotas.user(user.id),
      (old: QuotaData | null | undefined) => 
        old ? { ...old, benchmarks_used: old.benchmarks_used + 1 } : null
    );
  }, [user, enrichedQuotaData, queryClient]);

  // Fonction de reload manuel (invalide le cache React Query)
  const reloadQuota = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.quotas.user(user?.id || '') });
  }, [queryClient, user?.id]);

  return {
    quotaData: enrichedQuotaData,
    isLoading,
    error: queryError?.message || null,
    canExport,
    canCopyToClipboard,
    canAddToFavorites,
    canGenerateBenchmark,
    isAtLimit,
    incrementExport,
    incrementClipboardCopy,
    incrementFavorite,
    incrementBenchmark,
    reloadQuota
  };
};