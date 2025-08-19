// Client Algolia unifié avec optimisations avancées
import { algoliaCache } from './cacheManager';
import { requestDeduplicator } from './requestDeduplicator';
import { Origin, VALID_ALGOLIA_PARAMS, sanitizeFacetFilters, buildPrivateFilters, buildPublicFiltersBySources, mergeFederatedPair } from './searchClient';
import { debugFacetFilters, analyzeFilterConflicts } from './debugFilters';
import { createProxyClient } from './proxySearchClient';
import { liteClient as algoliasearch } from 'algoliasearch/lite';

const FALLBACK_APP_ID = import.meta.env.VITE_ALGOLIA_APPLICATION_ID;
const FALLBACK_SEARCH_KEY = import.meta.env.VITE_ALGOLIA_SEARCH_API_KEY;

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

      if (isLocalhost && FALLBACK_APP_ID && FALLBACK_SEARCH_KEY) {
        // Utiliser les clés directes seulement si elles sont définies
        this.clients = {
          fullPublic: algoliasearch(FALLBACK_APP_ID, FALLBACK_SEARCH_KEY),
          fullPrivate: algoliasearch(FALLBACK_APP_ID, FALLBACK_SEARCH_KEY)
        };
      } else {
        // Toujours utiliser les clients proxy sinon (dev sans clés ou production)
        this.clients = {
          fullPublic: createProxyClient('fullPublic'),
          fullPrivate: createProxyClient('fullPrivate')
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
    } catch (error: any) {
      // Gestion spéciale pour les erreurs Algolia 403 (application bloquée)
      if (error?.message?.includes('blocked') || error?.status === 403) {
        console.log('ℹ️ Algolia temporairement indisponible (plan payant requis)');
        // Résoudre avec des résultats vides plutôt que de rejeter
        batch.forEach((request, index) => {
          const resolve = (request as any).resolve;
          if (resolve) {
            resolve({
              results: [{
                hits: [],
                nbHits: 0,
                page: 0,
                nbPages: 0,
                hitsPerPage: request.params?.hitsPerPage || 10,
                processingTimeMS: 0,
                query: request.params?.query || '',
                params: ''
              }]
            });
          }
        });
        return;
      }
      
      // Rejeter toutes les promesses du batch pour les autres erreurs
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

    if (requests.length <= 1) {
      // Chemin existant (simple) pour conserver toute la logique de dédup/cache
      const results: any[] = [];
      for (const request of requests) {
        if (enableCache && !forceRefresh) {
          const cached = algoliaCache.get(request);
          if (cached) { results.push(cached.data); continue; }
        }
        const result = enableDeduplication
          ? await requestDeduplicator.deduplicateRequest(request, () => this.executeSingleRequest(request))
          : await this.executeSingleRequest(request);
        results.push(result);
        if (enableCache) algoliaCache.set(request, result, request.origin);
      }
      return { results };
    }

    // Regrouper en un minimum d'appels réseau
    const origin: Origin = (requests[0]?.origin as Origin) || 'all';

    // Hits cache et misses
    const hits: Array<{ index: number; data: any }> = [];
    const misses: Array<{ index: number; req: SearchRequest }> = [];
    if (enableCache && !forceRefresh) {
      requests.forEach((r, idx) => {
        const c = algoliaCache.get(r);
        if (c) hits.push({ index: idx, data: c.data });
        else misses.push({ index: idx, req: r });
      });
    } else {
      requests.forEach((r, idx) => misses.push({ index: idx, req: r }));
    }

    const assembled: any[] = new Array(requests.length);
    hits.forEach(h => { assembled[h.index] = h.data; });

    if (misses.length > 0) {
      // Construire les requêtes Algolia groupées
      const buildBase = (r: SearchRequest) => {
        const baseParams = { ...(r.params || {}) };
        const safeFacetFilters = sanitizeFacetFilters(baseParams.facetFilters);
        return { baseParams, safeFacetFilters };
      };

      const publicRequests: any[] = [];
      const privateRequests: any[] = [];
      const missOrder: Array<{ index: number; which: 'public'|'private'|'both' }> = [];

      for (const m of misses) {
        const { baseParams, safeFacetFilters } = buildBase(m.req);
        if (origin === 'public') {
          const accessFilters = (this.assignedSources && this.assignedSources.length > 0)
            ? [['access_level:standard', ...this.assignedSources.map(s => `Source:${s}`)]]
            : [['access_level:standard']];
          publicRequests.push({
            indexName: 'ef_all',
            params: {
              ...baseParams,
              facetFilters: [['scope:public'], ...accessFilters, ...(safeFacetFilters || [])],
              filters: baseParams.filters
            }
          });
          missOrder.push({ index: m.index, which: 'public' });
        } else if (origin === 'private') {
          const workspaceFilter = this.workspaceId ? [['workspace_id:' + this.workspaceId]] : [['workspace_id:_none_']];
          privateRequests.push({
            indexName: 'ef_all',
            params: {
              ...baseParams,
              facetFilters: [['scope:private'], ...workspaceFilter, ...(safeFacetFilters || [])],
              filters: baseParams.filters
            }
          });
          missOrder.push({ index: m.index, which: 'private' });
        } else { // all
          const accessFilters = (this.assignedSources && this.assignedSources.length > 0)
            ? [['access_level:standard', ...this.assignedSources.map(s => `Source:${s}`)]]
            : [['access_level:standard']];
          publicRequests.push({
            indexName: 'ef_all',
            params: {
              ...baseParams,
              facetFilters: [['scope:public'], ...accessFilters, ...(safeFacetFilters || [])],
              filters: baseParams.filters
            }
          });
          const workspaceFilter = this.workspaceId ? [['workspace_id:' + this.workspaceId]] : [['workspace_id:_none_']];
          privateRequests.push({
            indexName: 'ef_all',
            params: {
              ...baseParams,
              facetFilters: [['scope:private'], ...workspaceFilter, ...(safeFacetFilters || [])],
              filters: baseParams.filters
            }
          });
          missOrder.push({ index: m.index, which: 'both' });
        }
      }

      // Exécuter en 1 ou 2 appels
      let resPublic: any[] = [];
      let resPrivate: any[] = [];
      if (origin === 'public') {
        const rp = await this.clients!.fullPublic.search(publicRequests);
        resPublic = rp.results || [];
      } else if (origin === 'private') {
        const rpr = await this.clients!.fullPrivate.search(privateRequests);
        resPrivate = rpr.results || [];
      } else {
        const [rp, rr] = await Promise.all([
          this.clients!.fullPublic.search(publicRequests),
          this.clients!.fullPrivate.search(privateRequests)
        ]);
        resPublic = rp.results || [];
        resPrivate = rr.results || [];
      }

      // Reconstituer résultats des misses selon l'ordre
      let iPub = 0, iPriv = 0;
      for (const m of missOrder) {
        let value: any = { hits: [], nbHits: 0, nbPages: 0, page: 0, processingTimeMS: 0, facets: {}, facets_stats: null, query: '', params: '' };
        if (m.which === 'public') {
          value = resPublic[iPub++] || value;
        } else if (m.which === 'private') {
          value = resPrivate[iPriv++] || value;
        } else {
          const a = resPublic[iPub++] || value;
          const b = resPrivate[iPriv++] || value;
          value = mergeFederatedPair(a, b, { sumNbHits: true });
        }
        assembled[m.index] = value;
      }

      // Mettre en cache les misses
      if (enableCache) {
        misses.forEach((m) => {
          const val = assembled[m.index];
          if (val) algoliaCache.set(m.req, val, m.req.origin);
        });
      }
    }

    return { results: assembled };
  }

  private async executeSingleRequest(request: SearchRequest): Promise<any> {
    if (!this.clients) throw new Error('Clients not initialized');

    const origin = request.origin || 'all';
    const baseParams = { ...(request.params || {}) };
    
    // Debug des filtres entrants
    debugFacetFilters('1. Raw incoming facetFilters', baseParams.facetFilters, { origin });
    
    const safeFacetFilters = sanitizeFacetFilters(baseParams.facetFilters);
    
    // Debug après sanitization
    debugFacetFilters('2. After sanitizeFacetFilters', safeFacetFilters);

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
    // Utiliser facetFilters au lieu de filters pour éviter les syntaxes complexes
    const accessFilters = this.assignedSources && this.assignedSources.length > 0
      ? [['access_level:standard', ...this.assignedSources.map(s => `Source:${s}`)]]
      : [['access_level:standard']];
    
    const publicRequest = {
      indexName: 'ef_all',
      params: {
        ...baseParams,
        facetFilters: [['scope:public'], ...accessFilters, ...(safeFacetFilters || [])],
        filters: baseParams.filters // Garder seulement les filtres utilisateur
      }
    };

    const publicResult = await this.clients!.fullPublic.search([publicRequest]);
    return publicResult.results[0];
  }

  private async searchPrivateOnly(baseParams: any, safeFacetFilters: any): Promise<any> {
    // Utiliser facetFilters au lieu de filters complexes
    const workspaceFilter = this.workspaceId ? [['workspace_id:' + this.workspaceId]] : [['workspace_id:_none_']];
    
    const privateRequest = {
      indexName: 'ef_all',
      params: {
        ...baseParams,
        facetFilters: [['scope:private'], ...workspaceFilter, ...(safeFacetFilters || [])],
        filters: baseParams.filters // Garder seulement les filtres utilisateur
      }
    };

    const result = await this.clients!.fullPrivate.search([privateRequest]);
    return result.results[0];
  }

  private async searchFederated(baseParams: any, safeFacetFilters: any): Promise<any> {
    // Utiliser facetFilters au lieu de filters complexes
    const publicAccessFilters = this.assignedSources && this.assignedSources.length > 0
      ? [['access_level:standard', ...this.assignedSources.map(s => `Source:${s}`)]]
      : [['access_level:standard']];
    
    const workspaceFilter = this.workspaceId ? [['workspace_id:' + this.workspaceId]] : [['workspace_id:_none_']];

    const finalPublicFacetFilters = [['scope:public'], ...publicAccessFilters, ...(safeFacetFilters || [])];
    
    // Debug des filtres finaux pour public
    debugFacetFilters('3. Final PUBLIC facetFilters', finalPublicFacetFilters);
    analyzeFilterConflicts(finalPublicFacetFilters);
    
    const publicRequest = {
      indexName: 'ef_all',
      params: {
        ...baseParams,
        facetFilters: finalPublicFacetFilters,
        filters: baseParams.filters // Garder seulement les filtres utilisateur
      }
    };

    const privateRequest = {
      indexName: 'ef_all',
      params: {
        ...baseParams,
        facetFilters: [['scope:private'], ...workspaceFilter, ...(safeFacetFilters || [])],
        filters: baseParams.filters // Garder seulement les filtres utilisateur
      }
    };

    // Exécution en parallèle optimisée
    const [publicResult, privateResult] = await Promise.all([
      this.clients!.fullPublic.search([publicRequest]),
      this.clients!.fullPrivate.search([privateRequest])
    ]);

    // Merger public + private
    return mergeFederatedPair(
      publicResult.results[0], 
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
