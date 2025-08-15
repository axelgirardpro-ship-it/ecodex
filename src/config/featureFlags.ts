/**
 * Feature flags pour la configuration de l'application
 */

// Recherche fédérée sur ef_public_fr + ef_private_fr (false = index actuel)
export const USE_FEDERATED_SEARCH = import.meta.env.VITE_USE_FEDERATED_SEARCH === 'true';

// Nouvelle interface d'import supra-admin (false = interface actuelle)
export const NEW_ADMIN_IMPORT = import.meta.env.VITE_NEW_ADMIN_IMPORT === 'true';

// Debug: afficher les infos de debug dans la console
export const DEBUG_MULTI_INDEX = import.meta.env.VITE_DEBUG_MULTI_INDEX === 'true';

// Log l'état des feature flags en mode développement
if (import.meta.env.DEV && DEBUG_MULTI_INDEX) {
  console.log('🚀 Feature flags:', {
    USE_FEDERATED_SEARCH,
    NEW_ADMIN_IMPORT,
    DEBUG_MULTI_INDEX
  });
}