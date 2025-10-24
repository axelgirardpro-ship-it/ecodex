// Système d'initialisation automatique pour les optimisations Algolia
import { performanceMonitor } from './performanceMonitor';
import { algoliaCache } from './cacheManager';
import { currentConfig } from './productionConfig';
import { ALGOLIA_OPTIMIZATIONS } from '@/config/featureFlags';

class AlgoliaAutoInitializer {
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private lastAlertAt: Record<string, number> = {};
  private metricsTimer: ReturnType<typeof setInterval> | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.performInitialization();
    return this.initPromise;
  }

  private async performInitialization(): Promise<void> {
    // Logs désactivés pour console propre
    // if (import.meta.env.DEV) console.log('🚀 Initialisation du système Algolia optimisé...');

    try {
      // 1. Configurer le monitoring
      if (currentConfig.monitoring.enabled) {
        this.initializeMonitoring();
      }

      // 2. Configurer le cache
      if (currentConfig.cache.enabled) {
        this.initializeCache();
      }

      // 3. Démarrer l'auto-tuning si activé
      if (currentConfig.cache.autoTuning) {
        this.startAutoTuning();
      }

      // 4. Configurer les alertes
      this.setupAlerts();

      // 5. Enregistrer l'initialisation réussie
      this.recordSuccessfulInit();

      this.initialized = true;
      // Logs désactivés pour console propre
      // if (import.meta.env.DEV) console.log('✅ Système Algolia optimisé initialisé avec succès');

      // Logs désactivés pour console propre
      // if (ALGOLIA_OPTIMIZATIONS.DEBUG_PERFORMANCE) {
      //   console.log('📊 Configuration active:', currentConfig);
      // }

    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation Algolia:', error);
      // Ne pas bloquer l'application, continuer avec les valeurs par défaut
      this.initialized = true;
    }
  }

  private initializeMonitoring(): void {
    // Configurer les seuils d'alerte
    performanceMonitor.onAlert((alert) => {
      // Logs désactivés pour console propre
      // console.warn(`🚨 Alerte Algolia [${alert.severity}]:`, alert.message);
      if (!import.meta.env.DEV) {
        this.sendToMonitoringService(alert);
      }
    });

    // Métriques périodiques désactivées pour console propre
    // if (ALGOLIA_OPTIMIZATIONS.DEBUG_PERFORMANCE) {
    //   if (!this.metricsTimer) {
    //     this.metricsTimer = setInterval(() => {
    //       const blockedUntil = typeof window !== 'undefined' ? (window as Record<string, unknown>).__algoliaBlockedUntil as number : 0;
    //       if (blockedUntil && Date.now() < blockedUntil) return;
    //       const metrics = performanceMonitor.getMetrics();
    //       console.log('📈 Métriques Algolia:', {
    //         requests: metrics.totalRequests,
    //         successRate: ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(1) + '%',
    //         cacheHit: metrics.cacheHitRate.toFixed(1) + '%',
    //         avgTime: metrics.averageResponseTime.toFixed(0) + 'ms',
    //         savings: metrics.totalRequestsSaved
    //       });
    //     }, 30000);
    //   }
    // }
  }

  private initializeCache(): void {
    algoliaCache.autoTune();
    // Logs désactivés pour console propre
    // if (ALGOLIA_OPTIMIZATIONS.DEBUG_PERFORMANCE) {
    //   console.log('💾 Cache Algolia configuré:', algoliaCache.getCacheStats());
    // }
  }

  private startAutoTuning(): void {
    setInterval(() => {
      try {
        const adjustments = performanceMonitor.autoTune();
        algoliaCache.autoTune();
        // Logs désactivés pour console propre
        // if (ALGOLIA_OPTIMIZATIONS.DEBUG_PERFORMANCE) {
        //   console.log('🔧 Auto-tuning appliqué:', adjustments);
        // }
      } catch (error) {
        // Logs désactivés pour console propre
        // console.warn('⚠️ Erreur auto-tuning:', error);
      }
    }, 5 * 60 * 1000);
  }

  private setupAlerts(): void {
    setInterval(() => {
      const blockedUntil = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>).__algoliaBlockedUntil as number : 0;
      if (blockedUntil && Date.now() < blockedUntil) return;
      const metrics = performanceMonitor.getMetrics();
      const cacheStats = algoliaCache.getCacheStats();
      // Logs désactivés pour console propre
      // if (metrics.cacheHitRate < currentConfig.monitoring.alertThresholds.cacheHitRatePercent) {
      //   if (this.shouldLogAlert('cacheHitRate')) console.warn(`⚠️ Cache hit rate faible: ${metrics.cacheHitRate.toFixed(1)}%`);
      // }
      // if (metrics.averageResponseTime > currentConfig.monitoring.alertThresholds.responseTimeMs) {
      //   if (this.shouldLogAlert('responseTime')) console.warn(`⚠️ Temps de réponse élevé: ${metrics.averageResponseTime.toFixed(0)}ms`);
      // }
      // const errorRate = (metrics.failedRequests / Math.max(metrics.totalRequests, 1)) * 100;
      // if (errorRate > currentConfig.monitoring.alertThresholds.errorRatePercent) {
      //   if (this.shouldLogAlert('errorRate')) console.warn(`⚠️ Taux d'erreur élevé: ${errorRate.toFixed(1)}%`);
      // }
      if (metrics.cacheHitRate < 30) {
        algoliaCache.autoTune();
      }
    }, 2 * 60 * 1000);
  }

  private shouldLogAlert(key: string, minIntervalMs: number = 60_000): boolean {
    const now = Date.now();
    const prev = this.lastAlertAt[key] || 0;
    if (import.meta.env.DEV && now - prev < minIntervalMs) return false;
    this.lastAlertAt[key] = now;
    return true;
  }

  private recordSuccessfulInit(): void {
    performanceMonitor.recordRequest(
      0,
      true,
      'system',
      'algolia_optimization_init'
    );
  }

  private sendToMonitoringService(alert: { severity: string; message: string }): void {
    if (typeof window !== 'undefined' && 'fetch' in window) {
      fetch('/api/monitoring/algolia-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert,
          timestamp: Date.now(),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      }).catch(error => {
        console.warn('Erreur envoi monitoring:', error);
      });
    }
  }

  getStatus() {
    return {
      initialized: this.initialized,
      config: currentConfig,
      metrics: this.initialized ? performanceMonitor.getMetrics() : null,
      cacheStats: this.initialized ? algoliaCache.getCacheStats() : null
    };
  }

  async restart(): Promise<void> {
    console.log('🔄 Redémarrage du système Algolia optimisé...');
    this.initialized = false;
    this.initPromise = null;
    performanceMonitor.reset();
    algoliaCache.clear();
    await this.initialize();
  }

  forceOptimization(): void {
    if (!this.initialized) return;
    console.log('🚀 Optimisation forcée du système Algolia...');
    const adjustments = performanceMonitor.autoTune();
    algoliaCache.autoTune();
    console.log('✅ Optimisation appliquée:', adjustments);
  }
}

export const algoliaAutoInit = new AlgoliaAutoInitializer();

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      algoliaAutoInit.initialize();
    });
  } else {
    algoliaAutoInit.initialize();
  }
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).algoliaOptimizations = {
    autoInit: algoliaAutoInit,
    performanceMonitor,
    cache: algoliaCache,
    config: currentConfig
  };
  // Logs désactivés pour console propre
  // console.log('🔧 Outils de debug Algolia disponibles dans window.algoliaOptimizations');
}

export default algoliaAutoInit;
