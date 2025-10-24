// Utilitaires communs pour les providers Algolia

export const VALID_ALGOLIA_PARAMS = [
  'query','queryType','typoTolerance','minWordSizefor1Typo','minWordSizefor2Typos',
  'allowTyposOnNumericTokens','ignorePlurals','disableTypoToleranceOnAttributes',
  'attributesToIndex','attributesToRetrieve','unretrievableAttributes','optionalWords',
  'attributesToHighlight','attributesToSnippet','highlightPreTag','highlightPostTag',
  'snippetEllipsisText','restrictHighlightAndSnippetArrays','hitsPerPage','page',
  'offset','length','minProximity','getRankingInfo','clickAnalytics','analytics',
  'analyticsTags','synonyms','replaceSynonymsInHighlight','responseFields',
  'maxValuesPerFacet','sortFacetValuesBy','facets','maxFacetHits','attributesToRetrieve',
  'facetFilters','filters','numericFilters','tagFilters','sumOrFiltersScores','facetName','facetQuery',
  'restrictSearchableAttributes','facetingAfterDistinct','naturalLanguages','ruleContexts',
  'personalizationImpact','userToken','enablePersonalization',
  'distinct','attributeForDistinct','customRanking','ranking','relevancyStrictness',
  'facetQuery','searchForFacetValues','attributesToHighlight','highlightPreTag','highlightPostTag',
  // Paramètres internes destinés au proxy uniquement (filtrés côté edge avant Algolia)
  'workspace_id','_search_context'
];

/**
 * Type d'origine pour la recherche de facteurs d'émission
 * 
 * - 'public': Base commune - données gratuites et payantes selon assignations workspace
 * - 'private': Base personnelle - données importées par le workspace
 */
export type Origin = 'public' | 'private';

/**
 * Résout l'origine depuis les facetFilters Algolia
 * Fallback sur 'public' si aucune origine explicite trouvée
 */
export function resolveOriginFromFacetFilters(facetFilters: unknown): Origin {
  let origin: Origin = 'public'; // Fallback sur base commune
  const flat = Array.isArray(facetFilters) ? facetFilters.flat() : [];
  for (const f of flat) {
    if (typeof f === 'string' && f.startsWith('source_index:')) {
      const val = f.split(':')[1];
      if (val === 'public' || val === 'private') origin = val;
    }
  }
  return origin;
}

export function resolveOrigin(params: Record<string, unknown>): Origin {
  const rc: unknown[] = Array.isArray(params?.ruleContexts) ? params.ruleContexts : [];
  if (rc.includes('origin:public')) return 'public';
  if (rc.includes('origin:private')) return 'private';
  return resolveOriginFromFacetFilters(params?.facetFilters);
}

export function sanitizeFacetFilters(facetFilters: unknown): unknown {
  if (!facetFilters) return facetFilters;
  const isTechnicalFacet = (v: unknown) => {
    if (typeof v !== 'string') return false;
    // Retirer les facettes techniques pilotées par le provider
    return v.startsWith('source_index:') || v.startsWith('scope:');
  };
  if (Array.isArray(facetFilters)) {
    const cleaned = facetFilters
      .map((group) => {
        if (Array.isArray(group)) {
          const g = group.filter((v) => !isTechnicalFacet(v));
          return g.length > 0 ? g : null;
        }
        return isTechnicalFacet(group) ? null : group;
      })
      .filter((g) => g && (Array.isArray(g) ? g.length > 0 : true));
    return cleaned;
  }
  // Si c'est une chaîne (cas marginal), la normaliser en un groupe unique
  if (typeof facetFilters === 'string') {
    return [[facetFilters]];
  }
  return facetFilters;
}

// LEGACY FUNCTIONS REMOVED - Fonctions obsolètes avec l'architecture unifiée (un seul index ef_all)
// Ces fonctions étaient utilisées pour merger les résultats de plusieurs index (public/private)
// Maintenant, l'Edge Function gère directement les filtres scope:public et scope:private
// Le merge et le blur sont gérés côté serveur de manière sécurisée

export function buildFavoriteIdsFilter(favoriteIds?: string[]): string {
  if (!favoriteIds || favoriteIds.length === 0) return 'objectID:_none_';
  // Algolia: valeurs string doivent être entre guillemets (UUID avec tirets)
  const parts = favoriteIds
    .filter(Boolean)
    .map(id => `objectID:"${String(id).replace(/"/g, '"')}"`);
  return parts.length > 0 ? parts.join(' OR ') : 'objectID:_none_';
}

// LEGACY FILTER BUILDERS REMOVED
// Ces fonctions construisaient des filtres pour séparer public/private/teaser
// Maintenant géré côté serveur dans l'Edge Function algolia-search-proxy
// via les filtres scope:public et scope:private avec post-traitement du blur

export function favoriteIdsKey(ids?: string[]) {
  if (!ids || ids.length === 0) return '0::';
  return `${ids.length}:${ids[0] ?? ''}:${ids[ids.length - 1] ?? ''}`;
}
