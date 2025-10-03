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
export function resolveOriginFromFacetFilters(facetFilters: any): Origin {
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

export function resolveOrigin(params: any): Origin {
  const rc: any[] = Array.isArray(params?.ruleContexts) ? params.ruleContexts : [];
  if (rc.includes('origin:public')) return 'public';
  if (rc.includes('origin:private')) return 'private';
  return resolveOriginFromFacetFilters(params?.facetFilters);
}

export function sanitizeFacetFilters(facetFilters: any): any {
  if (!facetFilters) return facetFilters;
  const isTechnicalFacet = (v: any) => {
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

export function mergeFederatedPair(publicRes: any, privateRes: any, options?: { sumNbHits?: boolean }) {
  const emptyRes = {
    hits: [] as any[],
    nbHits: 0,
    nbPages: 0,
    page: 0,
    processingTimeMS: 0,
    facets: {},
    facets_stats: null,
    query: '',
    params: ''
  } as any;

  const a = publicRes || emptyRes;
  const b = privateRes || emptyRes;

  // Preserve base metadata from the first available response
  const baseForMetadata = a || b || emptyRes;
  const merged: any = { ...baseForMetadata };

  // Deduplicate hits by objectID while preserving order and prioritizing the first list
  const seenObjectIds = new Set<string>();
  const hits: any[] = [];
  const pushUnique = (arr?: any[]) => {
    for (const h of arr || []) {
      const id = String(h?.objectID ?? '');
      if (seenObjectIds.has(id)) continue;
      seenObjectIds.add(id);
      hits.push(h);
    }
  };
  pushUnique(a?.hits);
  pushUnique(b?.hits);

  merged.hits = hits;

  const getNbHits = (res: any) => {
    if (typeof res?.nbHits === 'number') return res.nbHits;
    const arr = Array.isArray(res?.hits) ? res.hits : [];
    return arr.length;
  };

  const baseNbHits = options?.sumNbHits ? getNbHits(a) + getNbHits(b) : getNbHits(a);
  merged.nbHits = typeof baseNbHits === 'number' && isFinite(baseNbHits) ? baseNbHits : 0;

  // Recalculer nbPages si on somme les jeux, sinon conserver l'info du premier
  const parseHitsPerPage = (paramsStr?: string): number | undefined => {
    if (!paramsStr || typeof paramsStr !== 'string') return undefined;
    const m = paramsStr.match(/(?:^|&)hitsPerPage=(\d+)(?:&|$)/);
    if (!m) return undefined;
    const v = Number(m[1]);
    return Number.isFinite(v) ? v : undefined;
  };
  if (options?.sumNbHits) {
    const hpp = parseHitsPerPage(a?.params) || parseHitsPerPage(b?.params) || 20;
    merged.nbPages = Math.ceil((merged.nbHits || 0) / hpp);
    // Page: conserver celle de la première réponse
    merged.page = typeof a?.page === 'number' ? a.page : (typeof b?.page === 'number' ? b.page : 0);
    // Processing time: max des deux
    const ptA = typeof a?.processingTimeMS === 'number' ? a.processingTimeMS : 0;
    const ptB = typeof b?.processingTimeMS === 'number' ? b.processingTimeMS : 0;
    merged.processingTimeMS = Math.max(ptA, ptB);
  } else {
    merged.nbPages = typeof a?.nbPages === 'number' ? a.nbPages : (typeof b?.nbPages === 'number' ? b.nbPages : 0);
    merged.page = typeof a?.page === 'number' ? a.page : (typeof b?.page === 'number' ? b.page : 0);
    merged.processingTimeMS = typeof a?.processingTimeMS === 'number' ? a.processingTimeMS : (typeof b?.processingTimeMS === 'number' ? b.processingTimeMS : 0);
  }
  merged.facets = mergeFacets(a?.facets, b?.facets);
  merged.facets_stats = a?.facets_stats || b?.facets_stats || null;

  return merged;
}

export function buildFavoriteIdsFilter(favoriteIds?: string[]): string {
  if (!favoriteIds || favoriteIds.length === 0) return 'objectID:_none_';
  // Algolia: valeurs string doivent être entre guillemets (UUID avec tirets)
  const parts = favoriteIds
    .filter(Boolean)
    .map(id => `objectID:"${String(id).replace(/"/g, '\"')}"`);
  return parts.length > 0 ? parts.join(' OR ') : 'objectID:_none_';
}

export function buildPublicFilters(wsId?: string, favoriteIdsFilter?: string) {
  const base = '(access_level:free)';
  // CORRECTION: assigned_workspace_ids est un ARRAY dans Algolia
  // Il faut utiliser assigned_workspace_ids:"uuid" (pas de = ou :)
  const ws = wsId ? ` OR (assigned_workspace_ids:"${wsId}")` : '';
  const fav = favoriteIdsFilter ? ` AND (${favoriteIdsFilter})` : '';
  return base + ws + fav;
}

export function buildPublicFiltersBySources(allowedSources: string[], favoriteIdsFilter?: string) {
  // Group1: Autorisé sans restriction
  // - free
  // - full (sera restreint par Group2)
  const group1 = '(access_level:free OR variant:full)';

  // Group2: restreindre les FULL paid aux sources assignées
  // On inclut free pour ne pas bloquer ces résultats
  const sourcesOr = (allowedSources && allowedSources.length)
    ? `(${allowedSources.map(s => `Source:"${s.replace(/\"/g, '\\\"').replace(/"/g, '\\"')}"`).join(' OR ')})`
    : '';
  const group2Base = '(access_level:free)';
  const group2 = sourcesOr ? `${group2Base} OR ${sourcesOr}` : group2Base;

  const fav = favoriteIdsFilter ? ` AND (${favoriteIdsFilter})` : '';
  return `(${group1}) AND (${group2})${fav}`;
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
