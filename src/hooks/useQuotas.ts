import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { useQuotaSync, type PlanType } from "@/hooks/useQuotaSync";
import { useQuotaRealtime } from "@/hooks/useOptimizedRealtime";

interface QuotaData {
  user_id: string;
  plan_type?: PlanType; // optionnel, non stocké dans search_quotas
  exports_limit: number | null; // null = unlimited
  clipboard_copies_limit: number | null; // null = unlimited
  favorites_limit: number | null; // null = unlimited
  exports_used: number;
  clipboard_copies_used: number;
  favorites_used: number;
}

export const useQuotas = () => {
  const { user } = useAuth();
  const { planType: effectivePlanType } = usePermissions();
  const [quotaData, setQuotaData] = useState<QuotaData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Synchroniser les quotas avec le plan utilisateur
  const { syncUserQuotas } = useQuotaSync();

  const loadQuotaData = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    // Synchroniser d'abord les quotas
    await syncUserQuotas();
    
    try {
      const { data, error } = await supabase
        .from('search_quotas')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        setError(error.message);
        return;
      }
      
      // Si aucun quota n'existe, en créer un par défaut
      if (!data) {
        const { data: newQuota, error: insertError } = await supabase
          .from('search_quotas')
          .insert({
            user_id: user.id,
            exports_limit: 0,
            clipboard_copies_limit: 10,
            favorites_limit: 10,
            exports_used: 0,
            clipboard_copies_used: 0,
            favorites_used: 0
          })
          .select()
          .single();
        
        if (insertError) {
          setError(insertError.message);
          return;
        }
        
        setQuotaData(newQuota as QuotaData);
      } else {
        // Injecter plan_type depuis les permissions si disponible
        const withPlan: QuotaData = { ...(data as QuotaData), plan_type: (effectivePlanType as any) };
        setQuotaData(withPlan);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [user, syncUserQuotas, effectivePlanType]);

  // Callback optimisé pour les mises à jour Realtime
  const handleQuotaUpdate = useCallback((payload: any) => {
    if (payload.eventType === 'UPDATE' && payload.new && payload.new.user_id === user?.id) {
      setQuotaData(payload.new as QuotaData);
    }
  }, [user?.id]);

  // Subscription Realtime optimisée
  useQuotaRealtime(user?.id, handleQuotaUpdate);

  useEffect(() => {
    loadQuotaData();
  }, [loadQuotaData]);



  // Logique simplifiée et cohérente pour les quotas (recherches illimitées)
  const canExport = quotaData ? 
    quotaData.exports_limit === null || quotaData.exports_used < quotaData.exports_limit 
    : false;
  
  // Vérifications pour les nouvelles limites
  const canCopyToClipboard = quotaData ? 
    quotaData.clipboard_copies_limit === null || quotaData.clipboard_copies_used < quotaData.clipboard_copies_limit 
    : false;
  const canAddToFavorites = quotaData ? 
    quotaData.favorites_limit === null || quotaData.favorites_used < quotaData.favorites_limit 
    : false;
  
  // Un utilisateur est "à la limite" s'il ne peut plus faire d'actions principales
  const isAtLimit = quotaData ? 
    !canExport || !canCopyToClipboard || !canAddToFavorites
    : false;
  
  const incrementExport = useCallback(async (count: number = 1) => {
    if (!user || !quotaData) return;
    
    // Ne pas incrémenter si les exports sont illimités (Pro)
    if (quotaData.exports_limit === null) {
      return;
    }
    
    const { error } = await supabase
      .from('search_quotas')
      .update({ exports_used: quotaData.exports_used + count })
      .eq('user_id', user.id);
    
    if (error) {
      throw error;
    }
    
    setQuotaData(prev => prev ? { ...prev, exports_used: prev.exports_used + count } : null);
  }, [user, quotaData]);
  
  const incrementClipboardCopy = useCallback(async (count: number = 1) => {
    if (!user || !quotaData) return;
    
    // Ne pas incrémenter si les copies sont illimitées (Pro)
    if (quotaData.clipboard_copies_limit === null) {
      return;
    }
    
    const { error } = await supabase
      .from('search_quotas')
      .update({ clipboard_copies_used: quotaData.clipboard_copies_used + count })
      .eq('user_id', user.id);
    
    if (error) {
      throw error;
    }
    
    setQuotaData(prev => prev ? { ...prev, clipboard_copies_used: prev.clipboard_copies_used + count } : null);
  }, [user, quotaData]);
  
  const incrementFavorite = useCallback(async () => {
    if (!user || !quotaData) return;
    
    // Ne pas incrémenter si les favoris sont illimités (Premium)
    if (quotaData.favorites_limit === null) {
      return;
    }
    
    const { error } = await supabase
      .from('search_quotas')
      .update({ favorites_used: quotaData.favorites_used + 1 })
      .eq('user_id', user.id);
    
    if (error) {
      throw error;
    }
    
    setQuotaData(prev => prev ? { ...prev, favorites_used: prev.favorites_used + 1 } : null);
  }, [user, quotaData]);

  return {
    quotaData,
    isLoading,
    error,
    canExport,
    canCopyToClipboard,
    canAddToFavorites,
    isAtLimit,
    incrementExport,
    incrementClipboardCopy,
    incrementFavorite,
    reloadQuota: loadQuotaData
  };
};