import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuotaSync, type PlanType } from "@/hooks/useQuotaSync";

interface QuotaData {
  user_id: string;
  plan_type: PlanType;
  exports_limit: number | null; // null = unlimited
  clipboard_copies_limit: number | null; // null = unlimited
  favorites_limit: number | null; // null = unlimited
  exports_used: number;
  clipboard_copies_used: number;
  favorites_used: number;
}

export const useQuotas = () => {
  const { user } = useAuth();
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
            plan_type: 'freemium',
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
        setQuotaData(data as QuotaData);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [user, syncUserQuotas]);

  // Supabase Realtime subscription
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    loadQuotaData();
  }, [loadQuotaData]);

  // Set up Realtime subscription (silenced logs)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('quota-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'search_quotas',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new) {
            setQuotaData(payload.new as QuotaData);
          }
        }
      )
      .subscribe((status) => {
        // silence noisy status logs in production
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user]);

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
    
    // Ne pas incrémenter si les exports sont illimités (Premium)
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
    
    // Ne pas incrémenter si les copies sont illimitées (Premium)
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