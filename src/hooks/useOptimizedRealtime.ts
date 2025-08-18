import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RealtimeConfig {
  table: string;
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | 'INSERT,UPDATE' | 'INSERT,DELETE' | 'UPDATE,DELETE' | '*';
  filter?: string;
  schema?: string;
  debounceMs?: number;
}

interface ChannelOptions {
  presence?: { key: string };
  broadcast?: { self: boolean };
  private?: boolean;
}

/**
 * Hook optimisé pour les subscriptions Realtime Supabase
 * Réduit les appels à realtime.list_changes en utilisant:
 * - Channels spécifiques avec ID unique
 * - Filtres d'événements précis
 * - Debounce pour éviter les appels multiples
 * - Nettoyage automatique des channels
 */
export const useOptimizedRealtime = (
  channelName: string,
  config: RealtimeConfig,
  callback: (payload: any) => void,
  dependencies: any[] = [],
  channelOptions?: ChannelOptions
) => {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCallback = useCallback((payload: any) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(payload);
    }, config.debounceMs || 100);
  }, [callback, config.debounceMs]);

  useEffect(() => {
    // Nettoyage préventif des anciens channels
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Créer un nouveau channel avec options optimisées
    const channel = supabase
      .channel(channelName, {
        config: {
          presence: channelOptions?.presence || { key: 'default' },
          broadcast: channelOptions?.broadcast || { self: false },
          private: channelOptions?.private || true
        }
      })
      .on(
        'postgres_changes',
        {
          event: config.event || 'UPDATE',
          schema: config.schema || 'public',
          table: config.table,
          filter: config.filter
        },
        debouncedCallback
      )
      .subscribe((status) => {
        // Log d'erreur uniquement en cas de problème
        if (status === 'SUBSCRIPTION_ERROR') {
          console.error(`Erreur subscription ${channelName}:`, status);
        }
      });

    channelRef.current = channel;

    return () => {
      // Nettoyage des timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      // Nettoyage du channel
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps

  // Méthode pour forcer la déconnexion du channel
  const disconnect = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, []);

  return { disconnect };
};

/**
 * Hook spécialisé pour les quotas utilisateur
 */
export const useQuotaRealtime = (
  userId: string | undefined,
  callback: (payload: any) => void
) => {
  return useOptimizedRealtime(
    `quota-updates-${userId}`,
    {
      table: 'search_quotas',
      event: 'UPDATE',
      filter: `user_id=eq.${userId}`
    },
    callback,
    [userId],
    {
      presence: { key: userId || 'anonymous' },
      broadcast: { self: false },
      private: true
    }
  );
};

/**
 * Hook spécialisé pour les assignations workspace-source
 */
export const useWorkspaceAssignmentsRealtime = (
  workspaceId: string | undefined,
  callback: (payload: any) => void
) => {
  return useOptimizedRealtime(
    `workspace-assignments-${workspaceId}`,
    {
      table: 'fe_source_workspace_assignments',
      event: 'INSERT,DELETE',
      filter: `workspace_id=eq.${workspaceId}`,
      debounceMs: 200
    },
    callback,
    [workspaceId],
    {
      presence: { key: workspaceId || 'default' },
      broadcast: { self: false },
      private: true
    }
  );
};

