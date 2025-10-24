// Configuration de production pour le système Algolia optimisé
import { ALGOLIA_OPTIMIZATIONS } from '@/config/featureFlags';

export interface ProductionConfig {
  // Configuration du cache
  cache: {
    enabled: boolean;
    ttlMs: number;
    maxSize: number;
    autoTuning: boolean;
  };
  
  // Configuration du throttling
  throttling: {
    enabled: boolean;
    requestsPerSecond: number;
    burstAllowance: number;
    adaptiveThrottling: boolean;
  };
  
  // Configuration du debouncing
  debouncing: {
    enabled: boolean;
    baseDelayMs: number;
    maxDelayMs: number;
    adaptiveDelay: boolean;
  };
  
  // Configuration du batching
  batching: {
    enabled: boolean;
    delayMs: number;
    maxBatchSize: number;
  };
  
  // Configuration du monitoring
  monitoring: {
    enabled: boolean;
    alertThresholds: {
      errorRatePercent: number;
      responseTimeMs: number;
      cacheHitRatePercent: number;
      requestRatePerMinute: number;
    };
    metricsRetentionHours: number;
  };
  
  // Configuration des suggestions
  suggestions: {
    enabled: boolean;
    maxSuggestions: number;
    prefixCacheEnabled: boolean;
    preloadingEnabled: boolean;
  };
}

// Configuration par défaut pour la production
export const PRODUCTION_CONFIG: ProductionConfig = {
  cache: {
    enabled: ALGOLIA_OPTIMIZATIONS.ENABLE_CACHE,
    ttlMs: ALGOLIA_OPTIMIZATIONS.CACHE_TTL_MS,
    maxSize: ALGOLIA_OPTIMIZATIONS.MAX_CACHE_SIZE,
    autoTuning: ALGOLIA_OPTIMIZATIONS.ENABLE_AUTO_TUNING
  },
  
  throttling: {
    enabled: ALGOLIA_OPTIMIZATIONS.ENABLE_SMART_THROTTLING,
    requestsPerSecond: ALGOLIA_OPTIMIZATIONS.THROTTLE_REQUESTS_PER_SECOND,
    burstAllowance: 10,
    adaptiveThrottling: true
  },
  
  debouncing: {
    enabled: true,
    baseDelayMs: ALGOLIA_OPTIMIZATIONS.DEBOUNCE_DELAY_MS,
    maxDelayMs: 1000,
    adaptiveDelay: true
  },
  
  batching: {
    enabled: ALGOLIA_OPTIMIZATIONS.ENABLE_BATCHING,
    delayMs: ALGOLIA_OPTIMIZATIONS.BATCH_DELAY_MS,
    maxBatchSize: ALGOLIA_OPTIMIZATIONS.MAX_BATCH_SIZE
  },
  
  monitoring: {
    enabled: ALGOLIA_OPTIMIZATIONS.ENABLE_PERFORMANCE_MONITORING,
    alertThresholds: {
      errorRatePercent: 5,
      responseTimeMs: 2000,
      cacheHitRatePercent: 70,
      requestRatePerMinute: 100
    },
    metricsRetentionHours: 24
  },
  
  suggestions: {
    enabled: ALGOLIA_OPTIMIZATIONS.ENABLE_SMART_SUGGESTIONS,
    maxSuggestions: 8,
    prefixCacheEnabled: true,
    preloadingEnabled: true
  }
};

// Configuration pour le développement (plus permissive)
export const DEVELOPMENT_CONFIG: ProductionConfig = {
  ...PRODUCTION_CONFIG,
  
  cache: {
    ...PRODUCTION_CONFIG.cache,
    ttlMs: 2 * 60 * 1000, // 2 minutes pour dev
    maxSize: 500
  },
  
  throttling: {
    ...PRODUCTION_CONFIG.throttling,
    requestsPerSecond: 10, // Plus permissif en dev
    burstAllowance: 20
  },
  
  monitoring: {
    ...PRODUCTION_CONFIG.monitoring,
    alertThresholds: {
      errorRatePercent: 10, // Plus tolérant en dev
      responseTimeMs: 5000,
      cacheHitRatePercent: 50,
      requestRatePerMinute: 200
    },
    metricsRetentionHours: 8 // Moins de rétention en dev
  }
};

// Sélection automatique de la configuration
export const getOptimalConfig = (): ProductionConfig => {
  const isDevelopment = import.meta.env.DEV;
  const isTest = import.meta.env.MODE === 'test';
  
  if (isTest) {
    // Configuration spéciale pour les tests
    return {
      ...DEVELOPMENT_CONFIG,
      cache: {
        ...DEVELOPMENT_CONFIG.cache,
        ttlMs: 1000, // TTL très court pour tests
        maxSize: 100
      },
      debouncing: {
        ...DEVELOPMENT_CONFIG.debouncing,
        baseDelayMs: 50 // Debounce très court pour tests
      },
      monitoring: {
        ...DEVELOPMENT_CONFIG.monitoring,
        metricsRetentionHours: 1
      }
    };
  }
  
  return isDevelopment ? DEVELOPMENT_CONFIG : PRODUCTION_CONFIG;
};

// Validation de la configuration
export const validateConfig = (config: ProductionConfig): string[] => {
  const errors: string[] = [];
  
  if (config.cache.ttlMs <= 0) {
    errors.push('Cache TTL doit être positif');
  }
  
  if (config.cache.maxSize <= 0) {
    errors.push('Taille maximale du cache doit être positive');
  }
  
  if (config.throttling.requestsPerSecond <= 0) {
    errors.push('Taux de throttling doit être positif');
  }
  
  if (config.debouncing.baseDelayMs < 0) {
    errors.push('Délai de debouncing doit être non-négatif');
  }
  
  if (config.batching.maxBatchSize <= 0) {
    errors.push('Taille maximale de batch doit être positive');
  }
  
  if (config.suggestions.maxSuggestions <= 0) {
    errors.push('Nombre maximum de suggestions doit être positif');
  }
  
  if (config.monitoring.alertThresholds.errorRatePercent < 0 || 
      config.monitoring.alertThresholds.errorRatePercent > 100) {
    errors.push('Seuil d\'erreur doit être entre 0 et 100%');
  }
  
  return errors;
};

// Optimisation automatique de la configuration basée sur l'environnement
export const optimizeConfigForEnvironment = (): ProductionConfig => {
  const baseConfig = getOptimalConfig();
  
  // Détection de l'environnement
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isSlowConnection = typeof navigator !== 'undefined' && 
    'connection' in navigator && 
    (navigator as unknown as { connection?: { effectiveType?: string } }).connection?.effectiveType === 'slow-2g';
  
  // Ajustements pour mobile ou connexion lente
  if (isMobile || isSlowConnection) {
    return {
      ...baseConfig,
      cache: {
        ...baseConfig.cache,
        ttlMs: baseConfig.cache.ttlMs * 1.5, // Cache plus long
        maxSize: Math.floor(baseConfig.cache.maxSize * 0.7) // Cache plus petit
      },
      debouncing: {
        ...baseConfig.debouncing,
        baseDelayMs: Math.floor(baseConfig.debouncing.baseDelayMs * 1.5) // Debounce plus long
      },
      batching: {
        ...baseConfig.batching,
        delayMs: baseConfig.batching.delayMs * 2, // Batching plus agressif
        maxBatchSize: Math.floor(baseConfig.batching.maxBatchSize * 1.5)
      }
    };
  }
  
  return baseConfig;
};

// Export de la configuration optimisée
export const currentConfig = optimizeConfigForEnvironment();

// Vérification de la configuration au démarrage
const configErrors = validateConfig(currentConfig);
if (configErrors.length > 0 && import.meta.env.DEV) {
  console.warn('⚠️ Erreurs de configuration Algolia:', configErrors);
}

// Logs désactivés pour console propre
// if (import.meta.env.DEV && ALGOLIA_OPTIMIZATIONS.DEBUG_PERFORMANCE) {
//   console.log('🔧 Configuration Algolia active:', currentConfig);
// }

export default currentConfig;
