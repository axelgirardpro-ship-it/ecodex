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
 * - Circuit breaker pour éviter les tentatives infinies en cas d'erreur
 */
export const useOptimizedRealtime = (
  channelName: string,
  config: RealtimeConfig,
  callback: (payload: Record<string, unknown>) => void,
  dependencies: unknown[] = [],
  channelOptions?: ChannelOptions
) => {
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const didUnmountRef = useRef<boolean>(false);
  const errorCountRef = useRef<number>(0);
  const maxRetries = 3;
  const isDisabledRef = useRef<boolean>(false);

  const debouncedCallback = useCallback((payload: Record<string, unknown>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(payload);
    }, config.debounceMs || 100);
  }, [callback, config.debounceMs]);

  useEffect(() => {
    didUnmountRef.current = false;
    
    // Si le circuit breaker est activé, ne pas réessayer
    if (isDisabledRef.current) {
      if (import.meta.env.DEV) {
        console.debug(`[Realtime] Canal ${channelName} désactivé par circuit breaker`);
      }
      return;
    }

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
          private: channelOptions?.private || false // CORRECTION: false par défaut pour éviter les erreurs
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
      .subscribe((status, err) => {
        // Réduire le bruit: ne pas logger les fermetures attendues (unmount/onglet caché)
        if (status === 'CLOSED') {
          const expected = didUnmountRef.current || (typeof document !== 'undefined' && document.visibilityState !== 'visible');
          if (!expected && import.meta.env.DEV) {
            console.debug(`[Realtime] Canal fermé: ${channelName}`);
          }
          return;
        }
        
        // Gestion des erreurs avec circuit breaker
        if ((status as string) === 'CHANNEL_ERROR' || (status as string) === 'TIMED_OUT') {
          errorCountRef.current += 1;
          
          if (import.meta.env.DEV) {
            console.warn(`[Realtime] Erreur ${errorCountRef.current}/${maxRetries} sur ${channelName}:`, err);
          }
          
          // Circuit breaker: désactiver après N erreurs
          if (errorCountRef.current >= maxRetries) {
            isDisabledRef.current = true;
            console.error(
              `[Realtime] Circuit breaker activé pour ${channelName} après ${maxRetries} erreurs. ` +
              `Le canal Realtime est désactivé. L'application continuera de fonctionner en mode polling.`
            );
            
            // Unsubscribe pour arrêter les tentatives
            if (channelRef.current) {
              supabase.removeChannel(channelRef.current);
              channelRef.current = null;
            }
          }
        }
        
        // Réinitialiser le compteur en cas de succès
        if (status === 'SUBSCRIBED') {
          errorCountRef.current = 0;
          if (import.meta.env.DEV) {
            console.debug(`[Realtime] Canal connecté avec succès: ${channelName}`);
          }
        }
      });

    channelRef.current = channel;

    return () => {
      didUnmountRef.current = true;
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

  // Méthode pour réinitialiser le circuit breaker
  const reset = useCallback(() => {
    errorCountRef.current = 0;
    isDisabledRef.current = false;
  }, []);

  return { disconnect, reset };
};

/**
 * Hook spécialisé pour les quotas utilisateur
 */
export const useQuotaRealtime = (
  userId: string | undefined,
  callback: (payload: Record<string, unknown>) => void
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
      private: false // CORRECTION: canal public avec filtrage RLS
    }
  );
};

/**
 * Hook spécialisé pour les assignations workspace-source
 */
export const useWorkspaceAssignmentsRealtime = (
  workspaceId: string | undefined,
  callback: (payload: Record<string, unknown>) => void
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
      private: false // CORRECTION: canal public avec filtrage RLS
    }
  );
};

