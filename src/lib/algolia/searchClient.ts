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
  'facetFilters','filters','numericFilters','tagFilters','sumOrFiltersScores',
  'restrictSearchableAttributes','facetingAfterDistinct','naturalLanguages','ruleContexts',
  'personalizationImpact','userToken','enablePersonalization',
  'distinct','attributeForDistinct','customRanking','ranking','relevancyStrictness',
  'facetQuery','searchForFacetValues','attributesToHighlight','highlightPreTag','highlightPostTag'
];

export type Origin = 'all' | 'public' | 'private';

export function resolveOriginFromFacetFilters(facetFilters: any): Origin {
  let origin: Origin = 'all';
  const flat = Array.isArray(facetFilters) ? facetFilters.flat() : [];
  for (const f of flat) {
    if (typeof f === 'string' && f.startsWith('source_index:')) {
      const val = f.split(':')[1];
      if (val === 'public' || val === 'private') origin = val;
    }
  }
  return origin;
}

export function resolveOrigin(params: any): Origin {
  const rc: any[] = Array.isArray(params?.ruleContexts) ? params.ruleContexts : [];
  if (rc.includes('origin:public')) return 'public';
  if (rc.includes('origin:private')) return 'private';
  return resolveOriginFromFacetFilters(params?.facetFilters);
}

export function sanitizeFacetFilters(facetFilters: any): any {
  if (!facetFilters) return facetFilters;
  const isSourceIndex = (v: any) => typeof v === 'string' && v.startsWith('source_index:');
  if (Array.isArray(facetFilters)) {
    const cleaned = facetFilters
      .map((group) => {
        if (Array.isArray(group)) {
          const g = group.filter((v) => !isSourceIndex(v));
          return g.length > 0 ? g : null;
        }
        return isSourceIndex(group) ? null : group;
      })
      .filter((g) => g && (Array.isArray(g) ? g.length > 0 : true));
    return cleaned;
  }
  return facetFilters;
}

export function mergeFacets(f1: any = {}, f2: any = {}) {
  const merged: any = {};
  const keys = new Set([ ...Object.keys(f1 || {}), ...Object.keys(f2 || {}) ]);
  keys.forEach((k) => {
    const a = f1?.[k] || {};
    const b = f2?.[k] || {};
    const sub = new Set([ ...Object.keys(a), ...Object.keys(b) ]);
    merged[k] = {};
    sub.forEach((sk) => {
      merged[k][sk] = (a[sk] || 0) + (b[sk] || 0);
    });
  });
  return merged;
}

export function mergeFederatedPair(publicRes: any, privateRes: any) {
  const merged = { ...publicRes };
  merged.hits = [...(privateRes?.hits || []), ...(publicRes?.hits || [] )];
  merged.nbHits = (publicRes?.nbHits || 0) + (privateRes?.nbHits || 0);
  merged.facets = mergeFacets(publicRes?.facets, privateRes?.facets);
  merged.facets_stats = publicRes?.facets_stats || privateRes?.facets_stats || null;
  return merged;
}

export function buildFavoriteIdsFilter(favoriteIds?: string[]): string {
  if (!favoriteIds || favoriteIds.length === 0) return 'objectID:_none_';
  return favoriteIds.map(id => `objectID:${id}`).join(' OR ');
}

export function buildPublicFilters(wsId?: string, favoriteIdsFilter?: string) {
  const base = '(access_level:standard) OR (is_blurred:true)';
  const ws = wsId ? ` OR (assigned_workspace_ids:${wsId})` : '';
  const fav = favoriteIdsFilter ? ` AND (${favoriteIdsFilter})` : '';
  return base + ws + fav;
}

export function buildPrivateFilters(wsId?: string, favoriteIdsFilter?: string) {
  const wsFilter = wsId ? `workspace_id:${wsId}` : 'workspace_id:_none_';
  const fav = favoriteIdsFilter ? ` AND (${favoriteIdsFilter})` : '';
  return wsFilter + fav;
}

export function favoriteIdsKey(ids?: string[]) {
  if (!ids || ids.length === 0) return '0::';
  return `${ids.length}:${ids[0] ?? ''}:${ids[ids.length - 1] ?? ''}`;
}
