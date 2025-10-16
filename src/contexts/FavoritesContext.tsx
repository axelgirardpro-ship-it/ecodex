import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useEmissionFactorAccess } from "@/hooks/useEmissionFactorAccess";
import { EmissionFactor } from '@/types/emission-factor';

interface FavoritesContextType {
  favorites: EmissionFactor[];
  loading: boolean;
  addToFavorites: (item: EmissionFactor) => Promise<void>;
  removeFromFavorites: (itemId: string) => Promise<void>;
  isFavorite: (itemId: string) => boolean;
  refreshFavorites: (forceRefresh?: boolean) => Promise<void>;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const useFavorites = () => {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error('useFavorites must be used within a FavoritesProvider');
  }
  return context;
};

interface FavoritesProviderProps {
  children: ReactNode;
}

export const FavoritesProvider = ({ children }: FavoritesProviderProps) => {
  const { user } = useAuth();
  const { canUseFavorites } = useEmissionFactorAccess();
  const [favorites, setFavorites] = useState<EmissionFactor[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number>(0);
  
  // Cache TTL: 30 seconds to avoid unnecessary re-fetches
  const CACHE_TTL = 30000;
  const lastRefreshRef = useRef<number>(0);

  // Helper function to map database format to EmissionFactor
  const mapDbToEmissionFactor = useCallback((data: any, itemId: string): EmissionFactor => {
    return {
      id: itemId,
      nom: data["Nom"] || data.nom || '',
      description: data["Description"] || data.description || '',
      fe: Number(data["FE"] || data.fe) || 0,
      uniteActivite: data["Unité donnée d'activité"] || data.uniteActivite || '',
      source: data["Source"] || data.source || '',
      secteur: data["Secteur"] || data.secteur || '',
      sousSecteur: data["Sous-secteur"] || data.sousSecteur || '',
      localisation: data["Localisation"] || data.localisation || '',
      date: Number(data["Date"] || data.date) || 0,
      incertitude: data["Incertitude"] || data.incertitude || '',
      perimetre: data["Périmètre"] || data.perimetre || '',
      contributeur: data["Contributeur"] || data.contributeur || '',
      contributeur_en: data["Contributeur_en"] || data.contributeur_en || '',
      methodologie: data["Méthodologie"] || data.methodologie || '',
      methodologie_en: data["Méthodologie_en"] || data.methodologie_en || '',
      typeDonnees: data["Type_de_données"] || data.typeDonnees || '',
      typeDonnees_en: data["Type_de_données_en"] || data.typeDonnees_en || '',
      commentaires: data["Commentaires"] || data.commentaires || '',
      isFavorite: true
    };
  }, []);

  // Optimized refresh function with cache
  const refreshFavorites = useCallback(async (forceRefresh = false) => {
    if (!user || !canUseFavorites()) {
      setFavorites([]);
      setLastRefresh(0);
      lastRefreshRef.current = 0;
      return;
    }

    // Check cache TTL unless force refresh
    const now = Date.now();
    if (!forceRefresh && lastRefreshRef.current && (now - lastRefreshRef.current) < CACHE_TTL) {
      return; // Use cached data
    }

    try {
      setLoading(true);
      
      const { data: favoritesData, error: favError } = await supabase
        .from('favorites')
        .select('item_id, item_data, created_at')
        .eq('user_id', user.id)
        .eq('item_type', 'emission_factor')
        .order('created_at', { ascending: false });

      if (favError) throw favError;

      if (!favoritesData || favoritesData.length === 0) {
        setFavorites([]);
        setLastRefresh(now);
        lastRefreshRef.current = now;
        return;
      }

      const processedFavorites = favoritesData
        .map(fav => {
          if (!fav.item_data) return null;
          return mapDbToEmissionFactor(fav.item_data, fav.item_id);
        })
        .filter(Boolean) as EmissionFactor[];

      setFavorites(processedFavorites);
      setLastRefresh(now);
      lastRefreshRef.current = now;
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoading(false);
    }
  }, [user, canUseFavorites, mapDbToEmissionFactor]);

  const addToFavorites = useCallback(async (item: EmissionFactor) => {
    if (!user || !canUseFavorites()) return;

    try {
      const { error } = await supabase
        .from('favorites')
        .insert({
          user_id: user.id,
          item_type: 'emission_factor',
          item_id: item.id,
          item_data: item as any
        });

      if (error) throw error;
      
      // Optimistic update with marked favorite
      setFavorites(prev => [...prev, { ...item, isFavorite: true }]);
      setLastRefresh(0); // Invalidate cache for next refresh
    } catch (error) {
      console.error('Error adding to favorites:', error);
      throw error;
    }
  }, [user, canUseFavorites]);

  const removeFromFavorites = useCallback(async (itemId: string) => {
    if (!user || !canUseFavorites()) return;

    try {
      // Optimistic update first for better UX
      setFavorites(prev => prev.filter(item => item.id !== itemId));
      
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('item_id', itemId);

      if (error) {
        // Revert optimistic update on error
        await refreshFavorites(true);
        throw error;
      }
      
      setLastRefresh(0); // Invalidate cache
    } catch (error) {
      console.error('Error removing from favorites:', error);
      throw error;
    }
  }, [user, canUseFavorites, refreshFavorites]);

  // Memoized favorites ID set for O(1) lookup
  const favoriteIds = useMemo(() => {
    return new Set(favorites.map(item => item.id));
  }, [favorites]);

  const isFavorite = useCallback((itemId: string) => {
    return favoriteIds.has(itemId);
  }, [favoriteIds]);

  // Optimized useEffect with debounce-like behavior
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (user && canUseFavorites()) {
      // Small delay to batch potential multiple calls
      timeoutId = setTimeout(() => {
        refreshFavorites();
      }, 100);
    } else {
      setFavorites([]);
      setLastRefresh(0);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user, canUseFavorites, refreshFavorites]);

  // Realtime: DÉSACTIVÉ temporairement pour éliminer les erreurs console
  // Les favoris se mettent à jour automatiquement après add/remove via l'état local
  // et via le refresh automatique (TTL cache)
  // Réactiver quand la configuration Supabase Realtime sera corrigée
  /*
  useEffect(() => {
    if (!user || !canUseFavorites()) return;

    const channel = supabase
      .channel(`favorites-realtime-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'favorites', filter: `user_id=eq.${user.id}` },
        (payload) => {
          try {
            if (payload.eventType === 'INSERT' && (payload.new as any)?.item_type === 'emission_factor') {
              const fav = mapDbToEmissionFactor((payload.new as any).item_data, (payload.new as any).item_id);
              setFavorites(prev => (prev.some(f => f.id === fav.id) ? prev : [...prev, fav]));
            }
            if (payload.eventType === 'DELETE') {
              const id = (payload.old as any)?.item_id;
              if (id) setFavorites(prev => prev.filter(f => f.id !== id));
            }
            if (payload.eventType === 'UPDATE' && (payload.new as any)?.item_type === 'emission_factor') {
              const fav = mapDbToEmissionFactor((payload.new as any).item_data, (payload.new as any).item_id);
              setFavorites(prev => prev.map(f => (f.id === fav.id ? fav : f)));
            }
          } catch (e) {
            // éviter de briser l'UI sur payload inattendu
            console.error('favorites realtime handler error', e);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, canUseFavorites, mapDbToEmissionFactor]);
  */

  return (
    <FavoritesContext.Provider value={{
      favorites,
      loading,
      addToFavorites,
      removeFromFavorites,
      isFavorite,
      refreshFavorites,
    }}>
      {children}
    </FavoritesContext.Provider>
  );
};