import React, { createContext, useContext } from 'react';
import { InstantSearch } from 'react-instantsearch';
import { liteClient as algoliasearch } from 'algoliasearch/lite';
import { useQuotas } from '@/hooks/useQuotas';
import { toast } from 'sonner';

// Client Algolia avec nettoyage exhaustif des paramètres
const ALGOLIA_APPLICATION_ID = import.meta.env.VITE_ALGOLIA_APPLICATION_ID || '6BGAS85TYS';
const ALGOLIA_SEARCH_API_KEY = import.meta.env.VITE_ALGOLIA_SEARCH_API_KEY || 'e06b7614aaff866708fbd2872de90d37';
const rawSearchClient = algoliasearch(ALGOLIA_APPLICATION_ID, ALGOLIA_SEARCH_API_KEY);

// Liste des paramètres valides Algolia
const VALID_ALGOLIA_PARAMS = [
  'query', 'queryType', 'typoTolerance', 'minWordSizefor1Typo', 'minWordSizefor2Typos',
  'allowTyposOnNumericTokens', 'ignorePlurals', 'disableTypoToleranceOnAttributes',
  'attributesToIndex', 'attributesToRetrieve', 'unretrievableAttributes', 'optionalWords',
  'attributesToHighlight', 'attributesToSnippet', 'highlightPreTag', 'highlightPostTag',
  'snippetEllipsisText', 'restrictHighlightAndSnippetArrays', 'hitsPerPage', 'page',
  'offset', 'length', 'minProximity', 'getRankingInfo', 'clickAnalytics', 'analytics',
  'analyticsTags', 'synonyms', 'replaceSynonymsInHighlight', 'minProximity', 'responseFields',
  'maxValuesPerFacet', 'sortFacetValuesBy', 'facets', 'maxFacetHits', 'attributesToRetrieve',
  'facetFilters', 'filters', 'numericFilters', 'tagFilters', 'sumOrFiltersScores',
  'restrictSearchableAttributes', 'facetingAfterDistinct', 'aroundLatLng', 'aroundLatLngViaIP',
  'aroundRadius', 'aroundPrecision', 'minimumAroundRadius', 'insideBoundingBox', 'insidePolygon',
  'naturalLanguages', 'ruleContexts', 'personalizationImpact', 'userToken', 'enablePersonalization',
  'distinct', 'attributeForDistinct', 'customRanking', 'ranking', 'relevancyStrictness',
  // Paramètres pour la recherche dans les facettes
  'facetQuery', 'searchForFacetValues'
];

// Wrapper pour nettoyer agressivement les paramètres
const searchClient = {
  ...rawSearchClient,
  search: (requests: any[]) => {
    console.log('🔍 Original search requests:', requests);
    
    const cleanedRequests = requests.map((request, index) => {
      if (!request.params) {
        return request;
      }
      
      const originalParams = { ...request.params };
      const cleanedParams: any = {};
      
      // Ne garder que les paramètres valides Algolia
      Object.keys(originalParams).forEach(key => {
        if (VALID_ALGOLIA_PARAMS.includes(key)) {
          cleanedParams[key] = originalParams[key];
        } else {
          console.log(`❌ Removing invalid parameter from request ${index}:`, key, '=', originalParams[key]);
        }
      });
      
      const cleanedRequest = {
        ...request,
        params: cleanedParams
      };
      
      // Retirer uniquement les numericFilters concernant FE pour éviter le conflit "managed vs advanced"
      const paramsAny: any = (cleanedRequest as any).params || {};
      const nf = paramsAny.numericFilters;
      if (Array.isArray(nf)) {
        const hasFE = (s: string) => /\bFE\b/.test(s);
        const cleanedNumericFilters = nf
          .map((group: any) => {
            if (Array.isArray(group)) {
              const sub = group.filter((item: any) => typeof item === 'string' ? !hasFE(item) : true);
              return sub;
            }
            return typeof group === 'string' ? (hasFE(group) ? null : group) : group;
          })
          .filter((g: any) => g && (!Array.isArray(g) || g.length > 0));

        if (cleanedNumericFilters.length !== nf.length) {
          console.log(`🧹 Removed FE numericFilters from request ${index}:`, nf, '=>', cleanedNumericFilters);
        }
        if (cleanedNumericFilters.length > 0) {
          paramsAny.numericFilters = cleanedNumericFilters;
        } else {
          delete paramsAny.numericFilters;
        }
      }

      console.log(`✅ Cleaned request ${index}:`, cleanedRequest);
      const nfAfter = (cleanedRequest as any)?.params?.numericFilters;
      if (nfAfter) {
        console.log(`🧮 numericFilters for request ${index} (after FE cleanup):`, nfAfter);
      }
      const filtersStr = (cleanedRequest as any)?.params?.filters;
      if (typeof filtersStr === 'string' && filtersStr.includes('FE')) {
        console.log(`ℹ️ filters string includes FE for request ${index}:`, filtersStr);
      }
      return cleanedRequest;
    });
    
    console.log('🚀 Final cleaned requests sent to Algolia:', cleanedRequests);
    
    return rawSearchClient.search(cleanedRequests);
  }
};

// Context pour partager les quotas
const QuotaContext = createContext<ReturnType<typeof useQuotas> | null>(null);

export const useQuotaContext = () => {
  const context = useContext(QuotaContext);
  if (!context) {
    throw new Error('useQuotaContext must be used within SearchProvider');
  }
  return context;
};

interface SearchProviderProps {
  children: React.ReactNode;
}

export const SearchProvider: React.FC<SearchProviderProps> = ({ children }) => {
  console.log('🔧 SearchProvider with exhaustive cleaning mounting...');
  const quotaHook = useQuotas();
  
  // Wrapper pour effectuer les recherches (plus de quota à vérifier)
  const quotaAwareSearchClient = {
    ...searchClient,
    search: async (requests: any[]) => {
      try {
        console.log('🔍 Performing search - no quota limits');
        const result = await searchClient.search(requests);
        return result;
      } catch (error) {
        console.error('Search error:', error);
        throw error;
      }
    }
  };
  
  return (
    <QuotaContext.Provider value={quotaHook}>
      <InstantSearch 
        searchClient={quotaAwareSearchClient as any} 
        indexName="emission_factors"
      >
        {children}
      </InstantSearch>
    </QuotaContext.Provider>
  );
};