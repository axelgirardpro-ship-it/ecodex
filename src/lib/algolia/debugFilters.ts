// Utilitaires de debug des filtres Algolia
// Ces fonctions sont optionnelles et n'ont aucun impact en production

type FacetFilters = unknown;

export function debugFacetFilters(label: string, filters: FacetFilters, context?: Record<string, unknown>) {
  // Ne loguer qu'en dev
  // import.meta.env n'est disponible qu'à l'exécution Vite
  try {
    // @ts-ignore
    const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
    if (!isDev) return;
  } catch {
    return;
  }

  // Logs désactivés pour console propre
  // try {
  //   // eslint-disable-next-line no-console
  //   console.debug(`[Algolia][Filters] ${label}`, { filters, ...(context || {}) });
  // } catch {
  //   // no-op
  // }
}

export function analyzeFilterConflicts(filters: FacetFilters): void {
  // Implémentation volontairement minimale: aucun blocage en prod
  // On pourrait ajouter ici des détections (ex: mêmes attributs contradictoires)
  void filters;
}


