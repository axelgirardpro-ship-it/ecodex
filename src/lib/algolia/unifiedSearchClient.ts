// Client Algolia unifié avec optimisations avancées
import { algoliaCache } from './cacheManager';
import { requestDeduplicator } from './requestDeduplicator';
import { Origin, VALID_ALGOLIA_PARAMS, sanitizeFacetFilters, buildPrivateFilters, buildPublicFiltersBySources, mergeFederatedPair } from './searchClient';
import { debugFacetFilters, analyzeFilterConflicts } from './debugFilters.ts';
import { createProxyClient } from './proxySearchClient';
import { liteClient as algoliasearch } from 'algoliasearch/lite';

// --- Circuit breaker Algolia (blocage temporaire quand l'application Algolia est bloquée) ---
let ALGOLIA_BLOCKED_UNTIL = 0;
let ALGOLIA_BLOCK_CONSECUTIVE_COUNT = 0;

function isAlgoliaTemporarilyBlocked(): boolean {
  return Date.now() < ALGOLIA_BLOCKED_UNTIL;
}

function markAlgoliaBlocked(): void {
  ALGOLIA_BLOCK_CONSECUTIVE_COUNT = Math.min(ALGOLIA_BLOCK_CONSECUTIVE_COUNT + 1, 6);
  const baseBackoffMs = 10 * 60_000; // 10 minutes
  const computed = Math.min(baseBackoffMs * Math.pow(2, ALGOLIA_BLOCK_CONSECUTIVE_COUNT - 1), 60 * 60 * 1000); // cap à 60 min
  ALGOLIA_BLOCKED_UNTIL = Date.now() + computed;
  if (typeof window !== 'undefined') {
    (window as any).__algoliaBlockedUntil = ALGOLIA_BLOCKED_UNTIL;
  }
}

function clearAlgoliaBlocked(): void {
  ALGOLIA_BLOCKED_UNTIL = 0;
  ALGOLIA_BLOCK_CONSECUTIVE_COUNT = 0;
  if (typeof window !== 'undefined') {
    (window as any).__algoliaBlockedUntil = 0;
  }
}

function isAlgoliaBlockedError(error: any): boolean {
  const status = error?.status ?? error?.httpStatusCode ?? error?.response?.status;
  const message = String(error?.message || '').toLowerCase();
  return status === 403 || message.includes('forbidden') || message.includes('blocked');
}

function buildEmptySingleResultFromRequest(req?: SearchRequest): any {
  const hitsPerPage = (req as any)?.params?.hitsPerPage || 10;
  const query = (req as any)?.params?.query || '';
  return {
    hits: [],
    nbHits: 0,
    page: 0,
    nbPages: 0,
    hitsPerPage,
    processingTimeMS: 0,
    query,
    params: ''
  };
}

function buildEmptyResultsForRequests(requests: SearchRequest[]): { results: any[] } {
  const ref = requests[0];
  return { results: requests.map(() => buildEmptySingleResultFromRequest(ref)) };
}

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
  // Permettre la requête teaser sur public (différé par le provider)
  teaserAllowed?: boolean;
}

/**
 * Client Algolia unifié optimisé
 * 
 * ARCHITECTURE SIMPLIFIÉE :
 * - Un seul client proxy vers l'Edge Function
 * - L'Edge Function gère la logique origine et teaser côté serveur
 * - Plus de clients multiples (fullPublic/fullPrivate/teaser)
 * - Sécurité garantie côté serveur
 */
export class UnifiedAlgoliaClient {
  private client: any | null = null;
  
  private initPromise: Promise<void> | null = null;
  private requestQueue: SearchRequest[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly batchDelay = 130; // 130ms de batching (regroupe mieux les frappes)
  private readonly maxBatchSize = 10;

  constructor(private workspaceId?: string, private assignedSources: string[] = []) {
    this.initializeClients();
  }

  private ensureObjectIdOnHits<T extends any>(res: any): any {
    if (!res || !Array.isArray(res.hits)) return res;
    const patched = res.hits.map((h: any) => {
      if (h && (h.objectID === undefined || h.objectID === null || h.objectID === '')) {
        const fallback = h.object_id ?? h.objectId ?? h.id;
        return fallback ? { ...h, objectID: String(fallback) } : h;
      }
      return h;
    });
    return { ...res, hits: patched };
  }

  /**
   * Initialisation simplifiée du client unifié
   * Un seul client proxy vers l'Edge Function optimisée
   */
  private async initializeClients(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      // Client unique vers l'Edge Function optimisée
      // Toute la logique origine/teaser/blur est gérée côté serveur
      this.client = createProxyClient('unified');
    })();

    return this.initPromise;
  }

  async search(
    requests: SearchRequest[], 
    options: OptimizedSearchOptions = {}
  ): Promise<{ results: any[] }> {
    await this.initializeClients();
    // Court-circuit si l'application Algolia est bloquée pour éviter des erreurs non-capturées
    if (isAlgoliaTemporarilyBlocked()) {
      return buildEmptyResultsForRequests(requests || []);
    }
    
    const {
      enableCache = true,
      enableDeduplication = true,
      enableBatching = true,
      forceRefresh = false,
      timeout = 5000,
      teaserAllowed = true
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
    // Ne garder que la DERNIÈRE requête pour éviter les multi-queries (une seule requête par saisie)
    const latestOnly = batch.length > 0 ? [batch[batch.length - 1]] : [];
    
    try {
      // Si bloqué, répondre immédiatement avec des résultats vides
      if (isAlgoliaTemporarilyBlocked()) {
        const empty = buildEmptyResultsForRequests(batch as any);
        batch.forEach((request, index) => {
          const resolve = (request as any).resolve;
          if (resolve) {
            resolve({ results: [empty.results[index]] });
          }
        });
        return;
      }

      const result = await this.processRequests(
        latestOnly.map(r => ({ ...r, resolve: undefined, reject: undefined }))
      );
      
      // Résoudre toutes les promesses du batch avec le même dernier résultat
      const single = result.results[0];
      batch.forEach((request) => {
        const resolve = (request as any).resolve;
        if (resolve) {
          resolve({ results: [single] });
        }
      });
    } catch (error: any) {
      // Gestion spéciale pour les erreurs Algolia 403 (application bloquée)
      if (isAlgoliaBlockedError(error)) {
        markAlgoliaBlocked();
        console.log('ℹ️ Algolia temporairement indisponible (plan payant requis)');
        // Résoudre avec des résultats vides plutôt que de rejeter
        batch.forEach((request) => {
          const resolve = (request as any).resolve;
          if (resolve) {
            resolve({ results: [buildEmptySingleResultFromRequest(request as any)] });
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

  /**
   * Traitement simplifié des requêtes
   * Toute la logique complexe est déportée vers l'Edge Function
   */
  private async processRequests(
    requests: SearchRequest[],
    options: OptimizedSearchOptions = {}
  ): Promise<{ results: any[] }> {
    const {
      enableCache = true,
      enableDeduplication = true,
      forceRefresh = false
    } = options;

    // Court-circuit si bloqué
    if (isAlgoliaTemporarilyBlocked()) {
      return buildEmptyResultsForRequests(requests);
    }

    try {
      const results: any[] = [];
      
      // Traitement simple : une requête = un appel à l'Edge Function
      for (const request of requests) {
        if (enableCache && !forceRefresh) {
          const cached = algoliaCache.get(request);
          if (cached) { 
            results.push(cached.data); 
            continue; 
          }
        }
        
        const result = enableDeduplication
          ? await requestDeduplicator.deduplicateRequest(request, () => this.executeSingleRequest(request))
          : await this.executeSingleRequest(request);
          
        results.push(result);
        
        if (enableCache) {
          algoliaCache.set(request, result, request.origin);
        }
      }

      // Algolia disponible => réinitialiser le blocage
      clearAlgoliaBlocked();
      return { results };
    } catch (error: any) {
      if (isAlgoliaBlockedError(error)) {
        markAlgoliaBlocked();
        console.log('ℹ️ Algolia temporairement indisponible (plan payant requis)');
      }
      // Ne jamais rejeter : retourner des résultats vides sûrs
      return buildEmptyResultsForRequests(requests);
    }
  }

  /**
   * Exécution simplifiée d'une requête unique
   * Délégation complète à l'Edge Function via le client proxy
   */
  private async executeSingleRequest(request: SearchRequest): Promise<any> {
    if (!this.client) throw new Error('Client not initialized');

    // Court-circuit si bloqué
    if (isAlgoliaTemporarilyBlocked()) {
      return buildEmptySingleResultFromRequest(request);
    }

    try {
      const origin = request.origin || 'public';
      const baseParams = { ...(request.params || {}) };
      
      // Debug des filtres entrants
      debugFacetFilters('1. Raw incoming facetFilters', baseParams.facetFilters, { origin });
      
      const safeFacetFilters = sanitizeFacetFilters(baseParams.facetFilters);
      
      // Debug après sanitization
      debugFacetFilters('2. After sanitizeFacetFilters', safeFacetFilters);

      // Délégation complète à l'Edge Function
      return this.searchUnified(origin, baseParams, safeFacetFilters);
    } catch (error: any) {
      if (isAlgoliaBlockedError(error)) {
        markAlgoliaBlocked();
        console.log('ℹ️ Algolia temporairement indisponible (plan payant requis)');
      }
      return buildEmptySingleResultFromRequest(request);
    }
  }

  /**
   * Recherche unifiée via l'Edge Function
   * Toute la logique métier est déportée côté serveur
   */
  private async searchUnified(origin: 'public'|'private', baseParams: any, safeFacetFilters: any): Promise<any> {
    const request = {
      indexName: 'ef_all',
      origin,
      params: {
        ...baseParams,
        facetFilters: safeFacetFilters,
        filters: baseParams.filters
      }
    } as any;
    
    // Délégation complète au client proxy vers l'Edge Function
    const result = await this.client.search([request]);
    return this.ensureObjectIdOnHits(result.results[0]);
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
    requestDeduplicator.clear();
  }
}

// Factory pour créer des instances optimisées
export const createUnifiedClient = (workspaceId?: string, assignedSources: string[] = []) => {
  return new UnifiedAlgoliaClient(workspaceId, assignedSources);
};
