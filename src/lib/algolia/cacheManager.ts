// Gestionnaire de cache intelligent pour Algolia
import { Origin } from './searchClient';
import type { SearchResponse } from 'algoliasearch';
import type { AlgoliaHit } from '@/types/algolia';

export interface CacheEntry {
  key: string;
  data: SearchResponse<AlgoliaHit>;
  timestamp: number;
  origin: Origin | 'all';
  ttl: number;
  accessCount: number;
  lastAccess: number;
}

export interface CacheRequest {
  query?: string;
  filters?: string;
  facetFilters?: unknown;
  origin?: Origin | 'all';
  hitsPerPage?: number;
  page?: number;
  params?: {
    query?: string;
    filters?: string;
    facetFilters?: unknown;
    hitsPerPage?: number;
    page?: number;
  };
}

export interface SearchMetrics {
  requestsPerMinute: number;
  cacheHitRate: number;
  avgResponseTime: number;
  duplicateRequests: number;
  totalRequests: number;
  savedRequests: number;
}

export class AlgoliaCacheManager {
  private cache = new Map<string, CacheEntry>();
  private metrics: SearchMetrics = {
    requestsPerMinute: 0,
    cacheHitRate: 0,
    avgResponseTime: 0,
    duplicateRequests: 0,
    totalRequests: 0,
    savedRequests: 0
  };
  private requestTimestamps: number[] = [];
  private baseTTL = 5 * 60 * 1000; // 5 minutes par défaut
  private maxCacheSize = 1000;

  private generateCacheKey(request: CacheRequest): string {
    // Supporter les paramètres passés dans request.params (InstantSearch)
    const req = request || {};
    const p = req.params || {};

    const query = (req.query ?? p.query ?? '') as string;
    const filters = (req.filters ?? p.filters ?? '') as string;
    const facetFiltersRaw = req.facetFilters ?? p.facetFilters ?? [];
    const origin = (req.origin ?? 'all') as string;
    const hitsPerPage = (req.hitsPerPage ?? p.hitsPerPage ?? 20) as number;
    const page = (req.page ?? p.page ?? 0) as number;

    // Normaliser les facetFilters pour un cache cohérent
    const normalizedFacets = Array.isArray(facetFiltersRaw) 
      ? facetFiltersRaw.flat().sort().join('|') 
      : String(facetFiltersRaw);

    return `${origin}:${query}:${filters}:${normalizedFacets}:${hitsPerPage}:${page}`;
  }

  private calculateAdaptiveTTL(request: CacheRequest): number {
    const p = request?.params || {};
    const q = (request?.query ?? p.query ?? '') as string;
    const facetFiltersValue = request?.facetFilters ?? p.facetFilters;
    const hasFilters =
      !!(request?.filters ?? p.filters ?? '').toString().trim() ||
      (Array.isArray(facetFiltersValue) && facetFiltersValue.length > 0);
    
    // TTL plus long pour requêtes complexes (moins susceptibles de changer)
    if (q.length > 6 && hasFilters) {
      return this.baseTTL * 2; // 10 minutes
    }
    
    // TTL plus court pour requêtes simples (plus volatiles)
    if (q.length < 3) {
      return this.baseTTL * 0.5; // 2.5 minutes
    }
    
    return this.baseTTL;
  }

  private updateMetrics() {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    
    // Nettoyer les anciens timestamps
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);
    this.metrics.requestsPerMinute = this.requestTimestamps.length;
    
    // Calculer le taux de hit cache
    const totalAttempts = this.metrics.totalRequests;
    this.metrics.cacheHitRate = totalAttempts > 0 
      ? (this.metrics.savedRequests / totalAttempts) * 100 
      : 0;
  }

  private evictOldEntries() {
    if (this.cache.size <= this.maxCacheSize) return;

    // Stratégie LRU avec pondération par accessCount
    const entries = Array.from(this.cache.entries());
    const sorted = entries.sort((a, b) => {
      const scoreA = a[1].accessCount / (Date.now() - a[1].lastAccess);
      const scoreB = b[1].accessCount / (Date.now() - b[1].lastAccess);
      return scoreA - scoreB;
    });

    // Supprimer 20% des entrées les moins utilisées
    const toRemove = Math.floor(this.cache.size * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(sorted[i][0]);
    }
  }

  get(request: CacheRequest): CacheEntry | null {
    const key = this.generateCacheKey(request);
    const entry = this.cache.get(key);
    
    this.metrics.totalRequests++;
    this.requestTimestamps.push(Date.now());
    
    if (!entry) {
      this.updateMetrics();
      return null;
    }
    
    const now = Date.now();
    
    // Vérifier expiration
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.updateMetrics();
      return null;
    }
    
    // Mettre à jour les stats d'accès
    entry.accessCount++;
    entry.lastAccess = now;
    this.metrics.savedRequests++;
    
    this.updateMetrics();
    return entry;
  }

  set(request: CacheRequest, data: SearchResponse<AlgoliaHit>, origin: Origin | 'all' = 'all'): void {
    const key = this.generateCacheKey(request);
    const ttl = this.calculateAdaptiveTTL(request);
    const now = Date.now();
    
    const entry: CacheEntry = {
      key,
      data,
      timestamp: now,
      origin,
      ttl,
      accessCount: 1,
      lastAccess: now
    };
    
    this.cache.set(key, entry);
    this.evictOldEntries();
  }

  invalidateBySource(source: string) {
    // Invalider toutes les entrées contenant cette source
    for (const [key, entry] of this.cache.entries()) {
      if (entry.data?.hits?.some(hit => hit.Source === source)) {
        this.cache.delete(key);
      }
    }
  }

  invalidateByOrigin(origin: Origin) {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.origin === origin || entry.origin === 'all') {
        this.cache.delete(key);
      }
    }
  }

  clear() {
    this.cache.clear();
    this.metrics = {
      requestsPerMinute: 0,
      cacheHitRate: 0,
      avgResponseTime: 0,
      duplicateRequests: 0,
      totalRequests: 0,
      savedRequests: 0
    };
  }

  getMetrics(): SearchMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  // Auto-tuning du cache basé sur les métriques
  autoTune() {
    const metrics = this.getMetrics();
    
    // Si taux de hit faible, augmenter TTL
    if (metrics.cacheHitRate < 30) {
      this.baseTTL = Math.min(this.baseTTL * 1.2, 15 * 60 * 1000); // Max 15 min
    }
    
    // Si beaucoup de requêtes dupliquées, augmenter la taille du cache
    if (metrics.duplicateRequests > 50) {
      this.maxCacheSize = Math.min(this.maxCacheSize * 1.1, 2000);
    }
    
    // Si trop de requêtes par minute, réduire TTL pour forcer plus de cache
    if (metrics.requestsPerMinute > 100) {
      this.baseTTL = Math.max(this.baseTTL * 0.8, 2 * 60 * 1000); // Min 2 min
    }
  }

  // Debug et monitoring
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      baseTTL: this.baseTTL,
      metrics: this.getMetrics(),
      entries: Array.from(this.cache.values()).map(entry => ({
        key: entry.key,
        age: Date.now() - entry.timestamp,
        accessCount: entry.accessCount,
        ttl: entry.ttl
      }))
    };
  }
}

// Instance globale partagée
export const algoliaCache = new AlgoliaCacheManager();
