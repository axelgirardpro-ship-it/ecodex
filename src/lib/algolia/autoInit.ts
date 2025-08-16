// Système d'initialisation automatique pour les optimisations Algolia
import { performanceMonitor } from './performanceMonitor';
import { algoliaCache } from './cacheManager';
import { smartSuggestionManager } from './smartSuggestions';
import { currentConfig } from './productionConfig';
import { ALGOLIA_OPTIMIZATIONS } from '@/config/featureFlags';

class AlgoliaAutoInitializer {
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.performInitialization();
    return this.initPromise;
  }

  private async performInitialization(): Promise<void> {
    console.log('🚀 Initialisation du système Algolia optimisé...');

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

      // 4. Précharger les données si nécessaire
      if (currentConfig.suggestions.preloadingEnabled) {
        await this.preloadCommonData();
      }

      // 5. Configurer les alertes
      this.setupAlerts();

      // 6. Enregistrer l'initialisation réussie
      this.recordSuccessfulInit();

      this.initialized = true;
      console.log('✅ Système Algolia optimisé initialisé avec succès');

      if (ALGOLIA_OPTIMIZATIONS.DEBUG_PERFORMANCE) {
        console.log('📊 Configuration active:', currentConfig);
      }

    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation Algolia:', error);
      // Ne pas bloquer l'application, continuer avec les valeurs par défaut
      this.initialized = true;
    }
  }

  private initializeMonitoring(): void {
    // Configurer les seuils d'alerte
    performanceMonitor.onAlert((alert) => {
      console.warn(`🚨 Alerte Algolia [${alert.severity}]:`, alert.message);
      
      // En production, on pourrait envoyer à un service de monitoring
      if (!import.meta.env.DEV) {
        this.sendToMonitoringService(alert);
      }
    });

    if (ALGOLIA_OPTIMIZATIONS.DEBUG_PERFORMANCE) {
      // En mode debug, afficher les métriques toutes les 30 secondes
      setInterval(() => {
        const metrics = performanceMonitor.getMetrics();
        console.log('📈 Métriques Algolia:', {
          requests: metrics.totalRequests,
          successRate: ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(1) + '%',
          cacheHit: metrics.cacheHitRate.toFixed(1) + '%',
          avgTime: metrics.averageResponseTime.toFixed(0) + 'ms',
          savings: metrics.totalRequestsSaved
        });
      }, 30000);
    }
  }

  private initializeCache(): void {
    // Optimiser la configuration du cache
    algoliaCache.autoTune();
    
    if (ALGOLIA_OPTIMIZATIONS.DEBUG_PERFORMANCE) {
      console.log('💾 Cache Algolia configuré:', algoliaCache.getCacheStats());
    }
  }

  private startAutoTuning(): void {
    // Auto-tuning toutes les 5 minutes
    setInterval(() => {
      try {
        const adjustments = performanceMonitor.autoTune();
        algoliaCache.autoTune();
        
        if (ALGOLIA_OPTIMIZATIONS.DEBUG_PERFORMANCE) {
          console.log('🔧 Auto-tuning appliqué:', adjustments);
        }
      } catch (error) {
        console.warn('⚠️ Erreur auto-tuning:', error);
      }
    }, 5 * 60 * 1000);
  }

  private async preloadCommonData(): Promise<void> {
    try {
      // Précharger les termes de recherche les plus populaires
      const commonSearchTerms = [
        'électricité',
        'transport',
        'chauffage',
        'gaz',
        'fioul',
        'bois',
        'eau',
        'déchets'
      ];

      // Configurer le contexte par défaut
      smartSuggestionManager.updateContext({
        origin: 'all',
        assignedSources: [],
        recentSearches: commonSearchTerms.slice(0, 3)
      });

      // Précharger en arrière-plan
      await smartSuggestionManager.preloadPopularPrefixes(commonSearchTerms);
      
      if (ALGOLIA_OPTIMIZATIONS.DEBUG_PERFORMANCE) {
        console.log('🔄 Préchargement terminé:', commonSearchTerms.length, 'termes');
      }
    } catch (error) {
      console.warn('⚠️ Erreur préchargement:', error);
    }
  }

  private setupAlerts(): void {
    // Vérification périodique de la santé du système
    setInterval(() => {
      const metrics = performanceMonitor.getMetrics();
      const cacheStats = algoliaCache.getCacheStats();
      
      // Alertes critiques
      if (metrics.cacheHitRate < currentConfig.monitoring.alertThresholds.cacheHitRatePercent) {
        console.warn(`⚠️ Cache hit rate faible: ${metrics.cacheHitRate.toFixed(1)}%`);
      }
      
      if (metrics.averageResponseTime > currentConfig.monitoring.alertThresholds.responseTimeMs) {
        console.warn(`⚠️ Temps de réponse élevé: ${metrics.averageResponseTime.toFixed(0)}ms`);
      }
      
      const errorRate = (metrics.failedRequests / Math.max(metrics.totalRequests, 1)) * 100;
      if (errorRate > currentConfig.monitoring.alertThresholds.errorRatePercent) {
        console.warn(`⚠️ Taux d'erreur élevé: ${errorRate.toFixed(1)}%`);
      }
      
      // Auto-correction si nécessaire
      if (metrics.cacheHitRate < 30) {
        algoliaCache.autoTune();
      }
      
    }, 2 * 60 * 1000); // Toutes les 2 minutes
  }

  private recordSuccessfulInit(): void {
    performanceMonitor.recordRequest(
      0, // pas de temps de réponse pour l'init
      true,
      'system',
      'algolia_optimization_init'
    );
  }

  private sendToMonitoringService(alert: any): void {
    // En production, intégrer avec votre service de monitoring
    // (Sentry, DataDog, New Relic, etc.)
    
    if (typeof window !== 'undefined' && 'fetch' in window) {
      // Exemple d'envoi vers un endpoint de monitoring
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

  // Méthodes utilitaires publiques
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
    
    // Reset des composants
    performanceMonitor.reset();
    algoliaCache.clear();
    smartSuggestionManager.clear();
    
    // Réinitialiser
    await this.initialize();
  }

  forceOptimization(): void {
    if (!this.initialized) return;
    
    console.log('🚀 Optimisation forcée du système Algolia...');
    
    // Appliquer immédiatement l'auto-tuning
    const adjustments = performanceMonitor.autoTune();
    algoliaCache.autoTune();
    
    console.log('✅ Optimisation appliquée:', adjustments);
  }
}

// Instance globale
export const algoliaAutoInit = new AlgoliaAutoInitializer();

// Auto-initialisation au chargement du module
if (typeof window !== 'undefined') {
  // Démarrer l'initialisation après le chargement de la page
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      algoliaAutoInit.initialize();
    });
  } else {
    // Page déjà chargée
    algoliaAutoInit.initialize();
  }
}

// Exposer dans le global pour debug en dev
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as any).algoliaOptimizations = {
    autoInit: algoliaAutoInit,
    performanceMonitor,
    cache: algoliaCache,
    suggestions: smartSuggestionManager,
    config: currentConfig
  };
  
  console.log('🔧 Outils de debug Algolia disponibles dans window.algoliaOptimizations');
}

export default algoliaAutoInit;
