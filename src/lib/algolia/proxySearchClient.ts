import { supabase } from '@/integrations/supabase/client';

export interface ProxySearchRequest {
  query?: string;
  filters?: string;
  facetFilters?: any;
  searchType: 'fullPublic' | 'fullPrivate';
  hitsPerPage?: number;
  page?: number;
  attributesToRetrieve?: string[];
  restrictSearchableAttributes?: string[];
  [key: string]: any;
}

export interface ProxySearchResponse {
  hits: any[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
  facets?: any;
  [key: string]: any;
}

class ProxySearchClient {
  async search(requests: ProxySearchRequest[]): Promise<{ results: ProxySearchResponse[] }> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No authentication token');
      }

      // Multi-queries: envoyer toutes les requêtes en un seul appel
      const response = await fetch('/functions/v1/algolia-search-proxy', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requests })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Search proxy error: ${error}`);
      }

      const json = await response.json();
      // L'Edge renvoie { results: [...] }
      if (Array.isArray(json?.results)) return { results: json.results };
      // Compatibilité si l'Edge renvoie une seule réponse
      return { results: [json] };
    } catch (error) {
      console.error('Proxy search client error:', error);
      throw error;
    }
  }

  async singleSearch(request: ProxySearchRequest): Promise<ProxySearchResponse> {
    const { results } = await this.search([request]);
    return results[0];
  }
}

export const proxySearchClient = new ProxySearchClient();

// Fonction helper pour créer des clients compatibles avec l'interface existante
export const createProxyClient = (searchType: 'fullPublic' | 'fullPrivate') => ({
  search: async (requests: any[]) => {
    const proxyRequests = requests.map(req => ({
      ...req.params,
      searchType,
      query: req.params?.query || '',
    }));
    return proxySearchClient.search(proxyRequests);
  }
});
