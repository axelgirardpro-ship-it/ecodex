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
    // Même logique que le cache pour cohérence, avec fallback sur request.params
    const req = request || {};
    const p = (req.params || {}) as any;

    const query = (req.query ?? p.query ?? '') as string;
    const filters = (req.filters ?? p.filters ?? '') as string;
    const facetFiltersRaw = (req.facetFilters ?? p.facetFilters ?? []) as any;
    const origin = (req.origin ?? 'all') as string;
    const hitsPerPage = (req.hitsPerPage ?? p.hitsPerPage ?? 20) as number;
    const page = (req.page ?? p.page ?? 0) as number;
    const indexName = (req.indexName ?? '') as string;

    const normalizedFacets = Array.isArray(facetFiltersRaw) 
      ? facetFiltersRaw.flat().sort().join('|') 
      : String(facetFiltersRaw);

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
    _request: any, 
    executeRequest: () => Promise<T>
  ): Promise<T> {
    // Déduplication désactivée pour garantir un ordre de ranking Algolia sans interférence
    return executeRequest();
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
    const req = request || {};
    const p = (req.params || {}) as any;

    const origin = (req.origin ?? 'all') as string;
    const indexName = (req.indexName ?? '') as string;
    const query = (req.query ?? p.query ?? '') as string;
    
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
