// Système de déduplication des requêtes Algolia
export interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
  requestCount: number;
}

export class RequestDeduplicator {
  private pendingRequests = new Map<string, PendingRequest>();
  private requestQueue = new Map<string, any[]>();
  private readonly timeout = 5000; // 5 secondes timeout

  private generateRequestKey(request: any): string {
    // Même logique que le cache pour cohérence
    const {
      query = '',
      filters = '',
      facetFilters = [],
      origin = 'all',
      hitsPerPage = 20,
      page = 0,
      indexName = ''
    } = request;

    const normalizedFacets = Array.isArray(facetFilters) 
      ? facetFilters.flat().sort().join('|') 
      : String(facetFilters);

    return `${indexName}:${origin}:${query}:${filters}:${normalizedFacets}:${hitsPerPage}:${page}`;
  }

  private cleanupExpiredRequests() {
    const now = Date.now();
    for (const [key, pending] of this.pendingRequests.entries()) {
      if (now - pending.timestamp > this.timeout) {
        this.pendingRequests.delete(key);
        this.requestQueue.delete(key);
      }
    }
  }

  async deduplicateRequest<T>(
    request: any, 
    executeRequest: () => Promise<T>
  ): Promise<T> {
    this.cleanupExpiredRequests();
    
    const key = this.generateRequestKey(request);
    const existing = this.pendingRequests.get(key);

    if (existing) {
      // Incrémenter le compteur de requêtes dupliquées
      existing.requestCount++;
      
      // Ajouter cette requête à la queue pour stats
      if (!this.requestQueue.has(key)) {
        this.requestQueue.set(key, []);
      }
      this.requestQueue.get(key)!.push(request);
      
      // Retourner la promesse existante
      return existing.promise;
    }

    // Créer une nouvelle requête
    const promise = executeRequest();
    const timestamp = Date.now();
    
    this.pendingRequests.set(key, {
      promise,
      timestamp,
      requestCount: 1
    });

    // Nettoyer quand la requête se termine
    promise.finally(() => {
      this.pendingRequests.delete(key);
      this.requestQueue.delete(key);
    });

    return promise;
  }

  // Analyser les patterns de duplication
  getDuplicationStats() {
    const stats = {
      activePendingRequests: this.pendingRequests.size,
      totalDuplicatedRequests: 0,
      mostDuplicatedKeys: [] as Array<{key: string, count: number}>
    };

    for (const [key, pending] of this.pendingRequests.entries()) {
      stats.totalDuplicatedRequests += pending.requestCount - 1;
    }

    // Top 10 des clés les plus dupliquées
    stats.mostDuplicatedKeys = Array.from(this.pendingRequests.entries())
      .map(([key, pending]) => ({ key, count: pending.requestCount }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return stats;
  }

  // Grouper plusieurs requêtes similaires
  batchSimilarRequests(requests: any[]): Map<string, any[]> {
    const batches = new Map<string, any[]>();
    
    for (const request of requests) {
      // Générer une clé de batch basée sur les paramètres similaires
      const batchKey = this.generateBatchKey(request);
      
      if (!batches.has(batchKey)) {
        batches.set(batchKey, []);
      }
      batches.get(batchKey)!.push(request);
    }
    
    return batches;
  }

  private generateBatchKey(request: any): string {
    // Clé simplifiée pour regrouper les requêtes similaires
    const {
      origin = 'all',
      indexName = '',
      query = ''
    } = request;
    
    // Grouper par origine, index et préfixe de requête
    const queryPrefix = query.substring(0, 3);
    return `${indexName}:${origin}:${queryPrefix}`;
  }

  clear() {
    this.pendingRequests.clear();
    this.requestQueue.clear();
  }
}

// Instance globale
export const requestDeduplicator = new RequestDeduplicator();
