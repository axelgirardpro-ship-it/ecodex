/**
 * Feature flags pour la configuration de l'application
 */

// Recherche unifiée (ef_all)
export const USE_FEDERATED_SEARCH = false;

// Nouvelle interface d'import supra-admin (false = interface actuelle)
export const NEW_ADMIN_IMPORT = import.meta.env.VITE_NEW_ADMIN_IMPORT === 'true';

// Debug: afficher les infos de debug dans la console
export const DEBUG_MULTI_INDEX = import.meta.env.VITE_DEBUG_MULTI_INDEX === 'true';

// Configuration des optimisations Algolia
export const ALGOLIA_OPTIMIZATIONS = {
  ENABLE_CACHE: true,
  ENABLE_DEDUPLICATION: true,
  ENABLE_BATCHING: true,
  ENABLE_SMART_THROTTLING: true,
  ENABLE_SMART_SUGGESTIONS: true,
  ENABLE_AUTO_TUNING: true,
  ENABLE_PERFORMANCE_MONITORING: true,
  DEBUG_PERFORMANCE: import.meta.env.DEV || DEBUG_MULTI_INDEX,
  CACHE_TTL_MS: 5 * 60 * 1000, // 5 minutes
  MAX_CACHE_SIZE: 1000,
  THROTTLE_REQUESTS_PER_SECOND: 5,
  DEBOUNCE_DELAY_MS: 300,
  BATCH_DELAY_MS: 50,
  MAX_BATCH_SIZE: 10
} as const;

// Log l'état des feature flags en mode développement
if (import.meta.env.DEV && DEBUG_MULTI_INDEX) {
  console.log('🚀 Feature flags:', {
    USE_FEDERATED_SEARCH,
    NEW_ADMIN_IMPORT,
    DEBUG_MULTI_INDEX,
    ALGOLIA_OPTIMIZATIONS
  });
}