// Système de monitoring et métriques de performance Algolia
export interface PerformanceMetrics {
  // Métriques de requêtes
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  
  // Métriques de cache
  cacheHitRate: number;
  cacheMissRate: number;
  cacheSize: number;
  
  // Métriques de déduplication
  duplicateRequestsAvoided: number;
  deduplicationRate: number;
  
  // Métriques de throttling
  throttledRequests: number;
  debouncedRequests: number;
  
  // Métriques d'économie
  totalRequestsSaved: number;
  estimatedCostSavings: number;
  
  // Métriques business
  searchesPerMinute: number;
  uniqueUsers: number;
  topSearchTerms: string[];
  
  // Timestamp
  lastUpdated: number;
}

export interface AlertConfig {
  errorRateThreshold: number; // %
  responseTimeThreshold: number; // ms
  cacheHitRateThreshold: number; // %
  requestRateThreshold: number; // req/min
}

export interface OptimizationRecommendation {
  type: 'cache' | 'throttling' | 'architecture' | 'indexing';
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  action: string;
  estimatedSavings?: number;
}

export class AlgoliaPerformanceMonitor {
  private metrics: PerformanceMetrics;
  private requestTimes: number[] = [];
  private requestTimestamps: number[] = [];
  private uniqueUsers = new Set<string>();
  private searchTerms = new Map<string, number>();
  private readonly maxHistorySize = 1000;
  private readonly metricsRetentionTime = 24 * 60 * 60 * 1000; // 24 heures
  private alertConfig: AlertConfig;
  private alertCallbacks: Array<(alert: any) => void> = [];

  constructor(alertConfig?: Partial<AlertConfig>) {
    this.alertConfig = {
      errorRateThreshold: 5, // 5%
      responseTimeThreshold: 2000, // 2 secondes
      cacheHitRateThreshold: 70, // 70%
      requestRateThreshold: 100, // 100 req/min
      ...alertConfig
    };

    this.metrics = this.initializeMetrics();
    this.startPeriodicCalculations();
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      cacheHitRate: 0,
      cacheMissRate: 0,
      cacheSize: 0,
      duplicateRequestsAvoided: 0,
      deduplicationRate: 0,
      throttledRequests: 0,
      debouncedRequests: 0,
      totalRequestsSaved: 0,
      estimatedCostSavings: 0,
      searchesPerMinute: 0,
      uniqueUsers: 0,
      topSearchTerms: [],
      lastUpdated: Date.now()
    };
  }

  // Enregistrer une requête
  recordRequest(
    responseTime: number,
    success: boolean,
    userId?: string,
    searchTerm?: string,
    fromCache = false
  ) {
    this.metrics.totalRequests++;
    
    if (success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    if (!fromCache) {
      this.requestTimes.push(responseTime);
      this.limitArraySize(this.requestTimes);
    }

    this.requestTimestamps.push(Date.now());
    this.limitArraySize(this.requestTimestamps);

    if (userId) {
      this.uniqueUsers.add(userId);
    }

    if (searchTerm && searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      this.searchTerms.set(term, (this.searchTerms.get(term) || 0) + 1);
    }

    this.updateDerivedMetrics();
    this.checkAlerts();
  }

  // Enregistrer une économie (cache hit, déduplication, etc.)
  recordSaving(type: 'cache' | 'deduplication' | 'throttling' | 'debouncing', count = 1) {
    switch (type) {
      case 'cache':
        // Géré dans recordRequest avec fromCache=true
        break;
      case 'deduplication':
        this.metrics.duplicateRequestsAvoided += count;
        break;
      case 'throttling':
        this.metrics.throttledRequests += count;
        break;
      case 'debouncing':
        this.metrics.debouncedRequests += count;
        break;
    }

    this.metrics.totalRequestsSaved += count;
    this.updateDerivedMetrics();
  }

  // Mettre à jour les métriques dérivées
  private updateDerivedMetrics() {
    const now = Date.now();
    
    // Calculer les temps de réponse
    if (this.requestTimes.length > 0) {
      const sorted = [...this.requestTimes].sort((a, b) => a - b);
      this.metrics.averageResponseTime = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      this.metrics.p95ResponseTime = sorted[Math.floor(sorted.length * 0.95)] || 0;
      this.metrics.p99ResponseTime = sorted[Math.floor(sorted.length * 0.99)] || 0;
    }

    // Calculer le taux de cache
    const totalCacheableRequests = this.metrics.totalRequests;
    if (totalCacheableRequests > 0) {
      const cacheHits = this.metrics.totalRequestsSaved + this.metrics.duplicateRequestsAvoided;
      this.metrics.cacheHitRate = (cacheHits / totalCacheableRequests) * 100;
      this.metrics.cacheMissRate = 100 - this.metrics.cacheHitRate;
    }

    // Calculer le taux de déduplication
    if (this.metrics.totalRequests > 0) {
      this.metrics.deduplicationRate = (this.metrics.duplicateRequestsAvoided / this.metrics.totalRequests) * 100;
    }

    // Calculer les requêtes par minute
    const oneMinuteAgo = now - 60 * 1000;
    const recentRequests = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);
    this.metrics.searchesPerMinute = recentRequests.length;

    // Utilisateurs uniques
    this.metrics.uniqueUsers = this.uniqueUsers.size;

    // Top termes de recherche
    this.metrics.topSearchTerms = Array.from(this.searchTerms.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([term]) => term);

    // Estimation des économies (approximation)
    const avgCostPerRequest = 0.01; // $0.01 par requête (estimation)
    this.metrics.estimatedCostSavings = this.metrics.totalRequestsSaved * avgCostPerRequest;

    this.metrics.lastUpdated = now;
  }

  // Vérifier les alertes
  private checkAlerts() {
    const alerts = [];

    // Taux d'erreur
    const errorRate = (this.metrics.failedRequests / this.metrics.totalRequests) * 100;
    if (errorRate > this.alertConfig.errorRateThreshold) {
      alerts.push({
        type: 'error_rate',
        severity: 'high',
        message: `Taux d'erreur élevé: ${errorRate.toFixed(1)}%`,
        threshold: this.alertConfig.errorRateThreshold,
        current: errorRate
      });
    }

    // Temps de réponse
    if (this.metrics.averageResponseTime > this.alertConfig.responseTimeThreshold) {
      alerts.push({
        type: 'response_time',
        severity: 'medium',
        message: `Temps de réponse élevé: ${this.metrics.averageResponseTime.toFixed(0)}ms`,
        threshold: this.alertConfig.responseTimeThreshold,
        current: this.metrics.averageResponseTime
      });
    }

    // Taux de cache
    if (this.metrics.cacheHitRate < this.alertConfig.cacheHitRateThreshold) {
      alerts.push({
        type: 'cache_hit_rate',
        severity: 'medium',
        message: `Taux de cache faible: ${this.metrics.cacheHitRate.toFixed(1)}%`,
        threshold: this.alertConfig.cacheHitRateThreshold,
        current: this.metrics.cacheHitRate
      });
    }

    // Taux de requêtes
    if (this.metrics.searchesPerMinute > this.alertConfig.requestRateThreshold) {
      alerts.push({
        type: 'request_rate',
        severity: 'low',
        message: `Taux de requêtes élevé: ${this.metrics.searchesPerMinute} req/min`,
        threshold: this.alertConfig.requestRateThreshold,
        current: this.metrics.searchesPerMinute
      });
    }

    // Déclencher les callbacks d'alerte
    alerts.forEach(alert => {
      this.alertCallbacks.forEach(callback => {
        try {
          callback(alert);
        } catch (error) {
          console.error('Error in alert callback:', error);
        }
      });
    });
  }

  // Générer des recommandations d'optimisation
  generateRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Recommandations basées sur le cache
    if (this.metrics.cacheHitRate < 60) {
      recommendations.push({
        type: 'cache',
        priority: 'high',
        title: 'Améliorer le taux de cache',
        description: `Le taux de cache actuel est de ${this.metrics.cacheHitRate.toFixed(1)}%, ce qui est sous-optimal.`,
        impact: 'Réduction significative des requêtes Algolia',
        action: 'Augmenter le TTL du cache et implémenter un cache préfixe plus agressif',
        estimatedSavings: this.calculateCacheSavings()
      });
    }

    // Recommandations basées sur les temps de réponse
    if (this.metrics.averageResponseTime > 1000) {
      recommendations.push({
        type: 'architecture',
        priority: 'medium',
        title: 'Optimiser les temps de réponse',
        description: `Le temps de réponse moyen est de ${this.metrics.averageResponseTime.toFixed(0)}ms.`,
        impact: 'Amélioration de l\'expérience utilisateur',
        action: 'Implémenter plus de parallélisme et optimiser les requêtes',
        estimatedSavings: 0
      });
    }

    // Recommandations basées sur la déduplication
    if (this.metrics.deduplicationRate < 30) {
      recommendations.push({
        type: 'architecture',
        priority: 'medium',
        title: 'Améliorer la déduplication',
        description: `Seulement ${this.metrics.deduplicationRate.toFixed(1)}% des requêtes sont dédupliquées.`,
        impact: 'Réduction des requêtes redondantes',
        action: 'Améliorer les clés de déduplication et augmenter la fenêtre de déduplication',
        estimatedSavings: this.calculateDeduplicationSavings()
      });
    }

    // Recommandations basées sur l'indexing
    if (this.metrics.searchesPerMinute > 200) {
      recommendations.push({
        type: 'indexing',
        priority: 'low',
        title: 'Optimiser la structure d\'index',
        description: 'Volume de recherches élevé détecté.',
        impact: 'Amélioration des performances générales',
        action: 'Réviser la structure des index et les attributs de recherche',
        estimatedSavings: 0
      });
    }

    // Trier par priorité
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  }

  private calculateCacheSavings(): number {
    const potentialCacheHitRate = 80; // Objectif réaliste
    const currentSavings = this.metrics.totalRequestsSaved;
    const potentialSavings = (this.metrics.totalRequests * potentialCacheHitRate / 100) - currentSavings;
    return Math.max(0, potentialSavings * 0.01); // $0.01 par requête
  }

  private calculateDeduplicationSavings(): number {
    const potentialDeduplicationRate = 50; // Objectif réaliste
    const currentDeduplication = this.metrics.duplicateRequestsAvoided;
    const potentialDeduplication = (this.metrics.totalRequests * potentialDeduplicationRate / 100) - currentDeduplication;
    return Math.max(0, potentialDeduplication * 0.01);
  }

  // Auto-tuning basé sur les métriques
  autoTune(): {
    cacheAdjustments: unknown;
    throttlingAdjustments: unknown;
    debounceAdjustments: unknown;
  } {
    const adjustments = {
      cacheAdjustments: {},
      throttlingAdjustments: {},
      debounceAdjustments: {}
    };

    // Ajustements du cache
    if (this.metrics.cacheHitRate < 50) {
      adjustments.cacheAdjustments = {
        increaseTTL: true,
        newTTL: Math.min(600000, 300000 * 1.5), // Augmenter TTL de 50%
        increaseMaxSize: true,
        newMaxSize: Math.min(2000, 1000 * 1.2) // Augmenter taille de 20%
      };
    }

    // Ajustements du throttling
    if (this.metrics.searchesPerMinute > 150) {
      adjustments.throttlingAdjustments = {
        reduceMaxRequestsPerSecond: true,
        newMaxRequestsPerSecond: Math.max(3, 5 * 0.8), // Réduire de 20%
        increaseBurstAllowance: false
      };
    }

    // Ajustements du debouncing
    if (this.metrics.averageResponseTime > 1500) {
      adjustments.debounceAdjustments = {
        increaseDelay: true,
        newBaseDelay: Math.min(500, 300 * 1.3), // Augmenter de 30%
        newMaxDelay: Math.min(1500, 1000 * 1.2)
      };
    }

    return adjustments;
  }

  // Méthodes utilitaires
  private limitArraySize(array: unknown[]) {
    if (array.length > this.maxHistorySize) {
      array.splice(0, array.length - this.maxHistorySize);
    }
  }

  private startPeriodicCalculations() {
    // Recalculer les métriques toutes les 30 secondes
    setInterval(() => {
      this.updateDerivedMetrics();
      this.cleanOldData();
    }, 30000);
  }

  private cleanOldData() {
    const cutoff = Date.now() - this.metricsRetentionTime;
    
    // Nettoyer les timestamps anciens
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > cutoff);
    
    // Nettoyer les termes de recherche peu utilisés
    for (const [term, count] of this.searchTerms.entries()) {
      if (count < 2) { // Seuil arbitraire
        this.searchTerms.delete(term);
      }
    }
  }

  // API publique
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  onAlert(callback: (alert: any) => void) {
    this.alertCallbacks.push(callback);
  }

  offAlert(callback: (alert: any) => void) {
    const index = this.alertCallbacks.indexOf(callback);
    if (index > -1) {
      this.alertCallbacks.splice(index, 1);
    }
  }

  reset() {
    this.metrics = this.initializeMetrics();
    this.requestTimes = [];
    this.requestTimestamps = [];
    this.uniqueUsers.clear();
    this.searchTerms.clear();
  }

  // Export pour analyse
  exportMetrics() {
    return {
      metrics: this.getMetrics(),
      recommendations: this.generateRecommendations(),
      autoTuneSettings: this.autoTune(),
      rawData: {
        requestTimes: [...this.requestTimes],
        requestTimestamps: [...this.requestTimestamps],
        searchTerms: Object.fromEntries(this.searchTerms),
        uniqueUsersCount: this.uniqueUsers.size
      }
    };
  }
}

// Instance globale
export const performanceMonitor = new AlgoliaPerformanceMonitor();
