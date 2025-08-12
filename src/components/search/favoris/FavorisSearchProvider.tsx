import React, { createContext, useContext, useRef } from 'react';
import { InstantSearch } from 'react-instantsearch';
import { liteClient as algoliasearch } from 'algoliasearch/lite';
import { useQuotas } from '@/hooks/useQuotas';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// Client Algolia avec nettoyage des paramètres
const ALGOLIA_APPLICATION_ID = import.meta.env.VITE_ALGOLIA_APPLICATION_ID || '6BGAS85TYS';
const ALGOLIA_SEARCH_API_KEY = import.meta.env.VITE_ALGOLIA_SEARCH_API_KEY || 'e06b7614aaff866708fbd2872de90d37';
const rawSearchClient = algoliasearch(ALGOLIA_APPLICATION_ID, ALGOLIA_SEARCH_API_KEY);

// Paramètres valides Algolia
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
  'facetQuery', 'searchForFacetValues'
];

// Context pour partager les quotas et favoris
const FavorisQuotaContext = createContext<ReturnType<typeof useQuotas> | null>(null);

export const useFavorisQuotaContext = () => {
  const context = useContext(FavorisQuotaContext);
  if (!context) {
    throw new Error('useFavorisQuotaContext must be used within FavorisSearchProvider');
  }
  return context;
};

interface FavorisSearchProviderProps {
  children: React.ReactNode;
}

export const FavorisSearchProvider: React.FC<FavorisSearchProviderProps> = ({ children }) => {
  console.log('🔧 FavorisSearchProvider mounting...');
  const quotaHook = useQuotas();
  const { favorites } = useFavorites();
  const { user } = useAuth();
  
  // Stabiliser le searchClient avec useRef pour éviter les re-renders
  const searchClientRef = useRef<any>(null);
  
  if (!searchClientRef.current) {
    searchClientRef.current = {
      ...rawSearchClient,
      search: async (requests: any[]) => {
        console.log('🔍 FavorisSearchProvider - Original requests:', requests);
        
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
              console.log(`❌ Removing invalid parameter from favoris request ${index}:`, key, '=', originalParams[key]);
            }
          });
          
          // Ajouter le filtre pour limiter aux favoris de l'utilisateur
          const favoriteIds = favorites.map(f => f.id);
          if (favoriteIds.length > 0 && user) {
            const favoritesFilter = `objectID:${favoriteIds.join(' OR objectID:')}`;
            cleanedParams.filters = cleanedParams.filters 
              ? `(${cleanedParams.filters}) AND (${favoritesFilter})`
              : favoritesFilter;
          } else {
            // Si pas de favoris, retourner une recherche vide
            cleanedParams.filters = 'objectID:__IMPOSSIBLE_ID__';
          }
          
          const cleanedRequest = {
            ...request,
            params: cleanedParams
          };
          
          // Nettoyer les numericFilters FE pour éviter les conflits
          const paramsAny: any = cleanedRequest.params || {};
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

            if (cleanedNumericFilters.length > 0) {
              paramsAny.numericFilters = cleanedNumericFilters;
            } else {
              delete paramsAny.numericFilters;
            }
          }

          console.log(`✅ Cleaned favoris request ${index}:`, cleanedRequest);
          return cleanedRequest;
        });
        
        console.log('🚀 Final favoris requests sent to Algolia:', cleanedRequests);
        return rawSearchClient.search(cleanedRequests);
      }
    };
  }

  // Wrapper pour effectuer les recherches (plus de quota à vérifier)
  const quotaAwareSearchClient = {
    ...searchClientRef.current,
    search: async (requests: any[]) => {
      try {
        console.log('🔍 Performing favoris search - no quota limits');
        const result = await searchClientRef.current.search(requests);
        return result;
      } catch (error) {
        console.error('Favoris search error:', error);
        throw error;
      }
    }
  };
  
  return (
    <FavorisQuotaContext.Provider value={quotaHook}>
      <InstantSearch 
        searchClient={quotaAwareSearchClient as any} 
        indexName="emission_factors"
      >
        {children}
      </InstantSearch>
    </FavorisQuotaContext.Provider>
  );
};