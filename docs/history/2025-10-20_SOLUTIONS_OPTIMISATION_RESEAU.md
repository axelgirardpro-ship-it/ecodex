# Solutions d'Optimisation Réseau - Guide d'Implémentation

## 🎯 Solution 1 : Implémenter React Query (PRIORITÉ CRITIQUE)

### Configuration initiale

**Fichier**: `src/lib/queryClient.ts` (nouveau fichier)

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache valide pendant 30 secondes par défaut
      staleTime: 30000,
      // Garde en cache pendant 5 minutes même si non utilisé
      cacheTime: 300000,
      // Une seule retry en cas d'erreur
      retry: 1,
      // Ne pas refetch automatiquement au focus de la fenêtre
      refetchOnWindowFocus: false,
      // Ne pas refetch au montage si les données sont fraîches
      refetchOnMount: false,
    },
  },
});
```

---

### Optimisation 1.1 : useQuotas.ts

**Fichier**: `src/hooks/useQuotas.ts`

**❌ Code actuel problématique** (approximatif):
```typescript
export const useQuotas = () => {
  const [quotas, setQuotas] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    
    const fetchQuotas = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('search_quotas')
        .select('*')
        .eq('user_id', user.id)
        .single();
      setQuotas(data);
      setLoading(false);
    };

    fetchQuotas();
  }, [user?.id]);

  return { quotas, loading };
};
```

**✅ Code optimisé avec React Query**:
```typescript
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// Clés de requête centralisées
export const quotaKeys = {
  all: ['quotas'] as const,
  user: (userId: string) => [...quotaKeys.all, userId] as const,
};

// Fonction de fetch isolée
const fetchUserQuotas = async (userId: string) => {
  const { data, error } = await supabase
    .from('search_quotas')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
};

export const useQuotas = () => {
  const { user } = useAuth();
  
  const query = useQuery({
    queryKey: quotaKeys.user(user?.id || ''),
    queryFn: () => fetchUserQuotas(user!.id),
    enabled: !!user?.id, // Ne lance la requête que si user existe
    staleTime: 30000, // 30 secondes
    cacheTime: 60000, // 1 minute
  });

  return {
    quotas: query.data,
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

// Hook pour invalider le cache manuellement
export const useInvalidateQuotas = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return () => {
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: quotaKeys.user(user.id) });
    }
  };
};
```

**Impact**: **32 requêtes → 1 requête** (réduction de 97% !)

---

### Optimisation 1.2 : useEmissionFactorAccess.ts

**Fichier**: `src/hooks/useEmissionFactorAccess.ts`

**✅ Code optimisé**:
```typescript
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { supabase } from '@/integrations/supabase/client';

// Clés de requête
export const sourceKeys = {
  global: ['fe_sources', 'global'] as const,
  workspace: (workspaceId: string) => ['fe_sources', 'workspace', workspaceId] as const,
};

// Fetch global sources (rarement modifié)
const fetchGlobalSources = async () => {
  const { data, error } = await supabase
    .from('fe_sources')
    .select('source_name, access_level, is_global')
    .eq('is_global', true);

  if (error) throw error;
  return data;
};

// Fetch workspace assignments
const fetchWorkspaceAssignments = async (workspaceId: string) => {
  const { data, error } = await supabase
    .from('fe_source_workspace_assignments')
    .select('source_name')
    .eq('workspace_id', workspaceId);

  if (error) throw error;
  return data;
};

export const useEmissionFactorAccess = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  // Query pour sources globales
  const globalSourcesQuery = useQuery({
    queryKey: sourceKeys.global,
    queryFn: fetchGlobalSources,
    staleTime: 300000, // 5 minutes (données rarement modifiées)
    cacheTime: 600000, // 10 minutes
  });

  // Query pour assignments workspace
  const assignmentsQuery = useQuery({
    queryKey: sourceKeys.workspace(currentWorkspace?.id || ''),
    queryFn: () => fetchWorkspaceAssignments(currentWorkspace!.id),
    enabled: !!currentWorkspace?.id,
    staleTime: 60000, // 1 minute
    cacheTime: 120000, // 2 minutes
  });

  // Combine les résultats
  const assignedSources = React.useMemo(() => {
    if (!globalSourcesQuery.data || !assignmentsQuery.data) return [];
    
    const workspaceSources = assignmentsQuery.data.map(a => a.source_name);
    const freeSources = globalSourcesQuery.data
      .filter(s => s.access_level === 'free')
      .map(s => s.source_name);
    
    return [...new Set([...workspaceSources, ...freeSources])];
  }, [globalSourcesQuery.data, assignmentsQuery.data]);

  return {
    assignedSources,
    globalSources: globalSourcesQuery.data || [],
    loading: globalSourcesQuery.isLoading || assignmentsQuery.isLoading,
    error: globalSourcesQuery.error || assignmentsQuery.error,
  };
};
```

**Impact**: 
- **19 requêtes fe_sources → 1 requête** (réduction de 95%)
- **18 requêtes assignments → 1 requête** (réduction de 94%)

---

### Optimisation 1.3 : useSupraAdmin.ts

**Fichier**: `src/hooks/useSupraAdmin.ts`

**✅ Code optimisé**:
```typescript
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const checkSupraAdmin = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase
    .rpc('is_supra_admin');

  if (error) {
    console.error('Error checking supra admin:', error);
    return false;
  }

  return data === true;
};

export const useSupraAdmin = () => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['is_supra_admin', user?.id],
    queryFn: () => checkSupraAdmin(user!.id),
    enabled: !!user?.id,
    // Permissions ne changent pas pendant la session
    staleTime: Infinity,
    cacheTime: Infinity,
  });

  return {
    isSupraAdmin: query.data || false,
    loading: query.isLoading,
  };
};
```

**Impact**: **10 requêtes → 1 requête** (réduction de 90%)

---

## 🎯 Solution 2 : Débouncer les upserts de quotas

**Fichier**: `src/hooks/useQuotaSync.ts` (ou fichier similaire)

### Créer un hook de debounce réutilisable

**Nouveau fichier**: `src/hooks/useDebouncedCallback.ts`
```typescript
import { useCallback, useRef } from 'react';

export const useDebouncedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): T => {
  const timeoutRef = useRef<NodeJS.Timeout>();

  return useCallback(
    ((...args) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    }) as T,
    [callback, delay]
  );
};
```

### Utiliser le debounce pour les quotas

**✅ Code optimisé**:
```typescript
import { useMutation } from '@tanstack/react-query';
import { useDebouncedCallback } from './useDebouncedCallback';
import { supabase } from '@/integrations/supabase/client';

const upsertQuota = async (userId: string, quotaData: any) => {
  const { data, error } = await supabase
    .from('search_quotas')
    .upsert({ user_id: userId, ...quotaData }, { onConflict: 'user_id' });

  if (error) throw error;
  return data;
};

export const useQuotaSync = () => {
  const { user } = useAuth();

  // Mutation pour upsert
  const mutation = useMutation({
    mutationFn: (quotaData: any) => upsertQuota(user!.id, quotaData),
  });

  // Debounce de 5 secondes
  const debouncedSync = useDebouncedCallback(
    (quotaData: any) => {
      mutation.mutate(quotaData);
    },
    5000
  );

  return {
    syncQuota: debouncedSync,
    isSyncing: mutation.isPending,
  };
};
```

**Impact**: **19 POST quotas → 1-2 POST** (réduction de 90%)

---

## 🎯 Solution 3 : Fixer les erreurs Realtime

**Fichier**: `src/contexts/FavoritesContext.tsx` (ou fichier concerné)

### Implémenter un backoff exponentiel

**Nouveau fichier**: `src/lib/realtimeBackoff.ts`
```typescript
export class RealtimeBackoff {
  private retryCount = 0;
  private maxRetries = 5;
  private baseDelay = 1000; // 1 seconde
  private maxDelay = 60000; // 1 minute
  private timeoutId?: NodeJS.Timeout;

  reset() {
    this.retryCount = 0;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
  }

  getDelay(): number {
    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.retryCount),
      this.maxDelay
    );
    return delay;
  }

  canRetry(): boolean {
    return this.retryCount < this.maxRetries;
  }

  incrementRetry() {
    this.retryCount++;
  }

  async wait(): Promise<void> {
    const delay = this.getDelay();
    console.log(`[Realtime] Waiting ${delay}ms before retry (attempt ${this.retryCount + 1}/${this.maxRetries})`);
    
    return new Promise((resolve) => {
      this.timeoutId = setTimeout(resolve, delay);
    });
  }
}
```

### Utiliser le backoff dans le contexte

**✅ Code optimisé**:
```typescript
import { RealtimeBackoff } from '@/lib/realtimeBackoff';

export const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export const FavoritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const backoffRef = useRef(new RealtimeBackoff());

  const setupRealtimeSubscription = useCallback(async () => {
    if (!user?.id) return;

    // Nettoyer l'ancien channel
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`quota-updates-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'favorites',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[Realtime] Received update:', payload);
          backoffRef.current.reset(); // Réinitialiser le compteur en cas de succès
          // Gérer le payload...
        }
      )
      .subscribe(async (status) => {
        console.log('[Realtime] Channel status:', status);

        if (status === 'CHANNEL_ERROR') {
          if (backoffRef.current.canRetry()) {
            backoffRef.current.incrementRetry();
            await backoffRef.current.wait();
            
            // Réessayer
            console.log('[Realtime] Retrying subscription...');
            setupRealtimeSubscription();
          } else {
            console.error('[Realtime] Max retries reached, giving up');
          }
        } else if (status === 'SUBSCRIBED') {
          backoffRef.current.reset();
          console.log('[Realtime] Successfully subscribed');
        }
      });

    channelRef.current = channel;
  }, [user?.id]);

  useEffect(() => {
    setupRealtimeSubscription();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [setupRealtimeSubscription]);

  // Reste du contexte...
};
```

**Impact**: 
- Moins d'erreurs dans la console
- Reconnexions intelligentes avec délais croissants
- Abandon après un certain nombre d'essais

---

## 🎯 Solution 4 : Cache des logos de sources

**Fichier**: `src/hooks/useSourceLogos.ts`

**✅ Code optimisé**:
```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const fetchSourceLogos = async () => {
  const { data, error } = await supabase
    .storage
    .from('source-logos')
    .list();

  if (error) throw error;
  
  // Créer un mapping nom → URL
  const logoMap: Record<string, string> = {};
  
  data.forEach((file) => {
    const sourceName = file.name.replace(/\.(png|svg|jpeg|jpg)$/, '');
    const url = supabase.storage
      .from('source-logos')
      .getPublicUrl(file.name).data.publicUrl;
    
    logoMap[sourceName] = url;
  });

  return logoMap;
};

export const useSourceLogos = () => {
  return useQuery({
    queryKey: ['source-logos'],
    queryFn: fetchSourceLogos,
    staleTime: 86400000, // 24 heures
    cacheTime: 86400000, // 24 heures
  });
};

// Hook pour obtenir l'URL d'un logo spécifique
export const useSourceLogo = (sourceName: string) => {
  const { data: logoMap } = useSourceLogos();
  return logoMap?.[sourceName] || null;
};
```

**Impact**: 
- Une seule requête au lieu de requêtes multiples
- Cache de 24h pour des données statiques

---

## 🎯 Solution 5 : Paralléliser les requêtes initiales

**Fichier**: `src/App.tsx` ou point d'entrée

### Précharger les données essentielles en parallèle

**✅ Code optimisé**:
```typescript
import { useQueries } from '@tanstack/react-query';
import { quotaKeys } from '@/hooks/useQuotas';
import { sourceKeys } from '@/hooks/useEmissionFactorAccess';

export const useInitialDataLoad = () => {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();

  // Lancer toutes les requêtes en parallèle
  const results = useQueries({
    queries: [
      {
        queryKey: quotaKeys.user(user?.id || ''),
        queryFn: () => fetchUserQuotas(user!.id),
        enabled: !!user?.id,
      },
      {
        queryKey: sourceKeys.global,
        queryFn: fetchGlobalSources,
        enabled: !!user?.id,
      },
      {
        queryKey: sourceKeys.workspace(currentWorkspace?.id || ''),
        queryFn: () => fetchWorkspaceAssignments(currentWorkspace!.id),
        enabled: !!currentWorkspace?.id,
      },
      {
        queryKey: ['is_supra_admin', user?.id],
        queryFn: () => checkSupraAdmin(user!.id),
        enabled: !!user?.id,
      },
      {
        queryKey: ['source-logos'],
        queryFn: fetchSourceLogos,
      },
    ],
  });

  const isLoading = results.some(r => r.isLoading);
  const hasError = results.some(r => r.error);

  return { isLoading, hasError, results };
};
```

**Impact**: 
- Requêtes lancées en parallèle au lieu de séquentiellement
- Réduction du temps de chargement de 30-40%

---

## 📦 Installation de React Query

**Fichier**: `package.json`

```bash
npm install @tanstack/react-query @tanstack/react-query-devtools
```

**Configuration dans App.tsx**:
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Votre app */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

---

## 🧪 Tests après implémentation

### Checklist de validation

- [ ] Le nombre de requêtes `search_quotas` est réduit à 1-2
- [ ] Le nombre de requêtes `fe_sources` est réduit à 1
- [ ] Le nombre de requêtes `fe_source_workspace_assignments` est réduit à 1
- [ ] Le nombre de POST `search_quotas` est réduit à 1-2
- [ ] Les erreurs Realtime ont disparu ou sont gérées proprement
- [ ] Le temps de chargement de la page search est < 2 secondes
- [ ] Les React Query DevTools montrent un cache efficace
- [ ] Aucune régression fonctionnelle

---

## 📊 Métriques de succès

| Métrique | Avant | Objectif | Comment mesurer |
|----------|-------|----------|-----------------|
| Requêtes Supabase totales | ~150 | < 30 | Network tab Chrome DevTools |
| Temps de chargement | 3-5s | < 2s | Lighthouse / DevTools Performance |
| POST quotas | 19+ | 1-2 | Network tab filtering |
| Erreurs console | Nombreuses | 0-2 | Console Chrome DevTools |
| Cache hit rate | 0% | > 70% | React Query DevTools |

---

## 🔄 Migration progressive

### Phase 1 (Jour 1) - Configuration
1. Installer React Query
2. Créer `queryClient.ts`
3. Wrapper l'app avec `QueryClientProvider`

### Phase 2 (Jour 2) - Hooks critiques
1. Migrer `useQuotas`
2. Migrer `useEmissionFactorAccess`
3. Migrer `useSupraAdmin`

### Phase 3 (Jour 3) - Debouncing et Realtime
1. Implémenter `useDebouncedCallback`
2. Débouncer les upserts de quotas
3. Fixer le backoff Realtime

### Phase 4 (Jour 4) - Optimisations finales
1. Cache des logos
2. Parallélisation
3. Tests et validation

### Phase 5 (Jour 5) - Monitoring
1. Vérifier les métriques
2. Ajuster les `staleTime` si nécessaire
3. Documentation

---

## 🚀 Quick Wins (1-2 heures)

Si vous avez peu de temps, commencez par ces optimisations à fort impact :

1. **useQuotas avec React Query** (45 min)
   - Impact : -97% de requêtes quotas
   
2. **Débounce POST quotas** (30 min)
   - Impact : -90% de POST

3. **Cache global sources** (30 min)
   - Impact : -95% de requêtes fe_sources

**Total : 1h45 pour -80% de requêtes globales !**

