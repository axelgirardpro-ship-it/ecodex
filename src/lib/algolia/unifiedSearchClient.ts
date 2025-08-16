// Client Algolia unifié avec optimisations avancées
import { algoliaCache } from './cacheManager';
import { requestDeduplicator } from './requestDeduplicator';
import { Origin, VALID_ALGOLIA_PARAMS, sanitizeFacetFilters, buildPrivateFilters, buildPublicFiltersBySources, mergeFederatedPair } from './searchClient';
import { createProxyClient } from './proxySearchClient';
import { liteClient as algoliasearch } from 'algoliasearch/lite';

const FALLBACK_APP_ID = import.meta.env.VITE_ALGOLIA_APPLICATION_ID || '6BGAS85TYS';
const FALLBACK_SEARCH_KEY = import.meta.env.VITE_ALGOLIA_SEARCH_API_KEY || 'e06b7614aaff866708fbd2872de90d37';

export interface SearchRequest {
  indexName?: string;
  params?: any;
  query?: string;
  origin?: Origin;
  priority?: number; // 1=highest, 3=lowest
}

export interface OptimizedSearchOptions {
  enableCache?: boolean;
  enableDeduplication?: boolean;
  enableBatching?: boolean;
  forceRefresh?: boolean;
  timeout?: number;
}

export class UnifiedAlgoliaClient {
  private clients: {
    fullPublic: any;
    fullPrivate: any;
    teaser: any;
  } | null = null;
  
  private initPromise: Promise<void> | null = null;
  private requestQueue: SearchRequest[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly batchDelay = 50; // 50ms de batching
  private readonly maxBatchSize = 10;

  constructor(private workspaceId?: string, private assignedSources: string[] = []) {
    this.initializeClients();
  }

  private async initializeClients(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const isLocalhost = typeof window !== 'undefined' && 
        /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);

      if (isLocalhost) {
        this.clients = {
          fullPublic: algoliasearch(FALLBACK_APP_ID, FALLBACK_SEARCH_KEY),
          fullPrivate: algoliasearch(FALLBACK_APP_ID, FALLBACK_SEARCH_KEY),
          teaser: algoliasearch(FALLBACK_APP_ID, FALLBACK_SEARCH_KEY)
        };
      } else {
        this.clients = {
          fullPublic: createProxyClient('fullPublic'),
          fullPrivate: createProxyClient('fullPrivate'),
          teaser: createProxyClient('teaserPublic')
        };
      }
    })();

    return this.initPromise;
  }

  async search(
    requests: SearchRequest[], 
    options: OptimizedSearchOptions = {}
  ): Promise<{ results: any[] }> {
    await this.initializeClients();
    
    const {
      enableCache = true,
      enableDeduplication = true,
      enableBatching = true,
      forceRefresh = false,
      timeout = 5000
    } = options;

    // Nettoyer et valider les requêtes
    const cleanRequests = this.cleanRequests(requests);
    
    // Si batching activé et pas de force refresh, ajouter à la queue
    if (enableBatching && !forceRefresh && cleanRequests.length === 1) {
      return this.addToBatch(cleanRequests[0]);
    }

    // Traitement immédiat pour requêtes multiples ou force refresh
    return this.processRequests(cleanRequests, {
      enableCache,
      enableDeduplication,
      forceRefresh,
      timeout
    });
  }

  private cleanRequests(requests: SearchRequest[]): SearchRequest[] {
    return requests.map(request => ({
      ...request,
      params: Object.fromEntries(
        Object.entries(request.params || {}).filter(([k]) => 
          VALID_ALGOLIA_PARAMS.includes(k)
        )
      )
    }));
  }

  private async addToBatch(request: SearchRequest): Promise<{ results: any[] }> {
    return new Promise((resolve, reject) => {
      // Ajouter la requête à la queue avec callback
      (request as any).resolve = resolve;
      (request as any).reject = reject;
      
      this.requestQueue.push(request);
      
      // Traiter immédiatement si queue pleine
      if (this.requestQueue.length >= this.maxBatchSize) {
        this.processBatch();
        return;
      }
      
      // Sinon programmer un batch
      this.scheduleBatch();
    });
  }

  private scheduleBatch() {
    if (this.batchTimer) return;
    
    this.batchTimer = setTimeout(() => {
      this.processBatch();
    }, this.batchDelay);
  }

  private async processBatch() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.requestQueue.length === 0) return;

    const batch = this.requestQueue.splice(0, this.maxBatchSize);
    
    try {
      const result = await this.processRequests(
        batch.map(r => ({ ...r, resolve: undefined, reject: undefined }))
      );
      
      // Résoudre toutes les promesses du batch
      batch.forEach((request, index) => {
        const resolve = (request as any).resolve;
        if (resolve) {
          resolve({ results: [result.results[index]] });
        }
      });
    } catch (error) {
      // Rejeter toutes les promesses du batch
      batch.forEach(request => {
        const reject = (request as any).reject;
        if (reject) reject(error);
      });
    }

    // Continuer avec le reste de la queue si nécessaire
    if (this.requestQueue.length > 0) {
      this.scheduleBatch();
    }
  }

  private async processRequests(
    requests: SearchRequest[],
    options: OptimizedSearchOptions = {}
  ): Promise<{ results: any[] }> {
    const {
      enableCache = true,
      enableDeduplication = true,
      forceRefresh = false
    } = options;

    const results: any[] = [];

    for (const request of requests) {
      // Vérifier le cache d'abord
      if (enableCache && !forceRefresh) {
        const cached = algoliaCache.get(request);
        if (cached) {
          results.push(cached.data);
          continue;
        }
      }

      // Déduplication si activée
      if (enableDeduplication) {
        const result = await requestDeduplicator.deduplicateRequest(
          request,
          () => this.executeSingleRequest(request)
        );
        results.push(result);
        
        // Mettre en cache le résultat
        if (enableCache) {
          algoliaCache.set(request, result, request.origin);
        }
      } else {
        const result = await this.executeSingleRequest(request);
        results.push(result);
        
        if (enableCache) {
          algoliaCache.set(request, result, request.origin);
        }
      }
    }

    return { results };
  }

  private async executeSingleRequest(request: SearchRequest): Promise<any> {
    if (!this.clients) throw new Error('Clients not initialized');

    const origin = request.origin || 'all';
    const baseParams = { ...(request.params || {}) };
    const safeFacetFilters = sanitizeFacetFilters(baseParams.facetFilters);

    // Optimisation intelligente selon l'origine
    switch (origin) {
      case 'public':
        return this.searchPublicOnly(baseParams, safeFacetFilters);
      
      case 'private':
        return this.searchPrivateOnly(baseParams, safeFacetFilters);
      
      default: // 'all'
        return this.searchFederated(baseParams, safeFacetFilters);
    }
  }

  private async searchPublicOnly(baseParams: any, safeFacetFilters: any): Promise<any> {
    const publicFilters = buildPublicFiltersBySources(this.assignedSources);
    
    const publicRequest = {
      indexName: 'ef_all',
      params: {
        ...baseParams,
        facetFilters: [['scope:public'], ...(safeFacetFilters || [])],
        filters: this.combineFilters(baseParams.filters, publicFilters)
      }
    };

    const [publicResult, teaserResult] = await Promise.all([
      this.clients!.fullPublic.search([publicRequest]),
      this.clients!.teaser.search([publicRequest])
    ]);

    return mergeFederatedPair(
      publicResult.results[0], 
      teaserResult.results[0]
    );
  }

  private async searchPrivateOnly(baseParams: any, safeFacetFilters: any): Promise<any> {
    const privateFilters = buildPrivateFilters(this.workspaceId);
    
    const privateRequest = {
      indexName: 'ef_all',
      params: {
        ...baseParams,
        facetFilters: [['scope:private'], ...(safeFacetFilters || [])],
        filters: this.combineFilters(baseParams.filters, privateFilters)
      }
    };

    const result = await this.clients!.fullPrivate.search([privateRequest]);
    return result.results[0];
  }

  private async searchFederated(baseParams: any, safeFacetFilters: any): Promise<any> {
    const publicFilters = buildPublicFiltersBySources(this.assignedSources);
    const privateFilters = buildPrivateFilters(this.workspaceId);

    const publicRequest = {
      indexName: 'ef_all',
      params: {
        ...baseParams,
        facetFilters: [['scope:public'], ...(safeFacetFilters || [])],
        filters: this.combineFilters(baseParams.filters, publicFilters)
      }
    };

    const privateRequest = {
      indexName: 'ef_all',
      params: {
        ...baseParams,
        facetFilters: [['scope:private'], ...(safeFacetFilters || [])],
        filters: this.combineFilters(baseParams.filters, privateFilters)
      }
    };

    // Exécution en parallèle optimisée
    const [publicResult, privateResult, teaserResult] = await Promise.all([
      this.clients!.fullPublic.search([publicRequest]),
      this.clients!.fullPrivate.search([privateRequest]),
      this.clients!.teaser.search([publicRequest])
    ]);

    // Merger les résultats public + teaser d'abord
    const mergedPublic = mergeFederatedPair(
      publicResult.results[0], 
      teaserResult.results[0]
    );

    // Puis merger avec private
    return mergeFederatedPair(
      mergedPublic, 
      privateResult.results[0], 
      { sumNbHits: true }
    );
  }

  private combineFilters(...filters: (string | undefined)[]): string | undefined {
    const validFilters = filters.filter(f => f && f.trim().length > 0);
    if (validFilters.length === 0) return undefined;
    if (validFilters.length === 1) return validFilters[0];
    return validFilters.map(f => `(${f})`).join(' AND ');
  }

  // Méthodes de monitoring et debug
  getPerformanceMetrics() {
    return {
      cache: algoliaCache.getMetrics(),
      deduplication: requestDeduplicator.getDuplicationStats(),
      queueSize: this.requestQueue.length,
      clientsInitialized: !!this.clients
    };
  }

  // Invalidation ciblée du cache
  invalidateCache(source?: string, origin?: Origin) {
    if (source) {
      algoliaCache.invalidateBySource(source);
    } else if (origin) {
      algoliaCache.invalidateByOrigin(origin);
    } else {
      algoliaCache.clear();
    }
  }

  // Auto-tuning
  optimize() {
    algoliaCache.autoTune();
  }

  // Nettoyage
  dispose() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    this.requestQueue = [];
    algoliaCache.clear();
    requestDeduplicator.clear();
  }
}

// Factory pour créer des instances optimisées
export const createUnifiedClient = (workspaceId?: string, assignedSources: string[] = []) => {
  return new UnifiedAlgoliaClient(workspaceId, assignedSources);
};
