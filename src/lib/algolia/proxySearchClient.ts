import { supabase } from '@/integrations/supabase/client';

export interface ProxySearchRequest {
  query?: string;
  filters?: string;
  facetFilters?: any;
  origin?: 'public' | 'private';
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
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const { data, error } = await supabase.functions.invoke('algolia-search-proxy', {
        body: { requests },
        headers
      });
      if (error) {
        throw new Error(`Search proxy error: ${error.message || JSON.stringify(error)}`);
      }
      const json = data as any;
      if (Array.isArray(json?.results)) return { results: json.results };
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
export const createProxyClient = (
  _type: 'unified' = 'unified'
) => ({
  search: async (requests: any[]) => {
    const proxyRequests = requests.map(req => {
      const origin = (req.origin as 'public'|'private'|undefined) || undefined;
      const params = req.params || {};
      const ws = params?._search_context?.workspace_id || params?.workspace_id;
      const base: any = { origin: origin || 'public', ...params } as ProxySearchRequest;
      if ((origin || 'public') === 'private' && typeof ws === 'string' && ws.length >= 36) {
        base.workspace_id = ws;
      }
      return base;
    });
    // Toujours envoyer en batch pour simplifier
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string,string> = {};
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;
    const { data, error } = await supabase.functions.invoke('algolia-search-proxy', {
      body: { requests: proxyRequests },
      headers
    });
    if (error) throw new Error(`Search proxy error: ${error.message || JSON.stringify(error)}`);
    const json = data as any;
    if (Array.isArray(json?.results)) return { results: json.results };
    return { results: [json] };
  }
});
