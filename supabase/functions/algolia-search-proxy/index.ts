// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// Cache TTL (ms) pour les requêtes identiques
const CACHE_TTL_MS = Number(Deno.env.get('EDGE_CACHE_TTL_MS') ?? '3000');
type CacheEntry = { ts: number; data: any };
const cacheStore = new Map<string, CacheEntry>();

function encodeParams(params: Record<string, any>): string {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v) || typeof v === 'object') {
      flat[k] = JSON.stringify(v);
    } else {
      flat[k] = String(v);
    }
  }
  return Object.entries(flat)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

function getCache(key: string): any | null {
  const it = cacheStore.get(key);
  if (!it) return null;
  if (Date.now() - it.ts > CACHE_TTL_MS) {
    cacheStore.delete(key);
    return null;
  }
  return it.data;
}

function setCache(key: string, data: any): void {
  cacheStore.set(key, { ts: Date.now(), data });
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

function jsonResponse(status: number, data: any, origin?: string | null) {
  const headers = { ...corsHeaders, 'Content-Type': 'application/json' }
  if (origin) headers['Access-Control-Allow-Origin'] = origin
  return new Response(JSON.stringify(data), { status, headers })
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const ALGOLIA_APP_ID = Deno.env.get('ALGOLIA_APP_ID')!
    const ALGOLIA_ADMIN_KEY = Deno.env.get('ALGOLIA_ADMIN_KEY')!
    const ALGOLIA_INDEX_ALL = Deno.env.get('ALGOLIA_INDEX_ALL') || 'ef_all'

    const origin = req.headers.get('Origin')
    
    // Vérifier l'authentification (souple: public autorisé sans auth, privé interdit)
    const authHeader = req.headers.get('Authorization')
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: authHeader ? { headers: { Authorization: authHeader } } : undefined
    })

    let userId: string | null = null
    if (authHeader) {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (!authError && user) {
        userId = user.id
      }
    }

    // Récupérer le body de la requête
    const rawBody = await req.json()
    const isBatch = Array.isArray(rawBody?.requests)
    const incomingRequests = isBatch ? rawBody.requests : [rawBody]

    // Récupérer le workspace de l'utilisateur (table users)
    let workspaceId: string | null = null
    if (userId) {
      const { data: userRow } = await supabase
        .from('users')
        .select('workspace_id')
        .eq('user_id', userId)
        .single()
      workspaceId = userRow?.workspace_id ?? null
    }

    // Helper unifié: applique origin "public" ou "private" + sécurité premium
    const buildUnified = (originParam: 'public'|'private'|undefined, searchTypeParam?: string) => {
      const origin = originParam || (searchTypeParam === 'fullPrivate' ? 'private' : 'public')
      let appliedFilters = ''
      let appliedFacetFilters: any[] = []
      let attributesToRetrieve: string[] | undefined
      if (origin === 'public') {
        appliedFilters = `scope:public`
        // Groupe d'accès sécurisé: standard OU premium
        const premiumGroup = ['access_level:premium']
        const standardGroup = ['access_level:standard']
        if (workspaceId) {
          // OR entre standard et premium assigné au workspace
          appliedFacetFilters = [[ 'access_level:standard', `assigned_workspace_ids:${workspaceId}` ]]
          attributesToRetrieve = undefined
        } else {
          // OR entre standard et premium (teaser)
          appliedFacetFilters = [[ 'access_level:standard', 'access_level:premium' ]]
          attributesToRetrieve = [
            'objectID','scope','languages','access_level','Source','Date',
            'Nom_fr','Secteur_fr','Sous-secteur_fr','Localisation_fr','Périmètre_fr',
            'Nom_en','Secteur_en','Sous-secteur_en','Localisation_en','Périmètre_en'
          ]
        }
      } else {
        // private
        if (!userId) {
          appliedFilters = `scope:private AND workspace_id:_none_`
        } else {
          appliedFilters = workspaceId
            ? `scope:private AND workspace_id:${workspaceId}`
            : `scope:private AND workspace_id:_none_`
        }
        attributesToRetrieve = undefined
      }
      return { appliedFilters, appliedFacetFilters, attributesToRetrieve }
    }

    // Construire les requêtes Algolia (multi)
    type BuiltReq = {
      cacheKey: string,
      body: any,
      index: number
    }
    const built: BuiltReq[] = incomingRequests.map((r: any, idx: number) => {
      const { query, filters, facetFilters, origin: reqOrigin, searchType, hitsPerPage, page, attributesToRetrieve: attrsClient, restrictSearchableAttributes } = r || {}
      const { appliedFilters, appliedFacetFilters, attributesToRetrieve } = buildUnified(
        (reqOrigin as 'public'|'private'|undefined), String(searchType || '')
      )
      const combinedFilters = filters ? `(${appliedFilters}) AND (${filters})` : appliedFilters
      let combinedFacetFilters: any[] = [...appliedFacetFilters]
      if (facetFilters) {
        if (Array.isArray(facetFilters)) combinedFacetFilters = [...combinedFacetFilters, ...facetFilters]
        else combinedFacetFilters.push(facetFilters)
      }
      const paramsObj: Record<string, any> = {
        query: query || '',
        filters: combinedFilters,
        facetFilters: combinedFacetFilters.length > 0 ? combinedFacetFilters : undefined,
        ...(attributesToRetrieve ? { attributesToRetrieve } : (attrsClient ? { attributesToRetrieve: attrsClient } : {})),
        ...(typeof hitsPerPage === 'number' ? { hitsPerPage } : {}),
        ...(typeof page === 'number' ? { page } : {}),
        ...(restrictSearchableAttributes ? { restrictSearchableAttributes } : {}),
        // Balises de highlight attendues par React InstantSearch
        highlightPreTag: '__ais-highlight__',
        highlightPostTag: '__/ais-highlight__'
      }
      const cacheKey = JSON.stringify({
        workspaceId,
        origin: reqOrigin || 'public',
        params: paramsObj
      })
      return {
        cacheKey,
        body: {
          indexName: ALGOLIA_INDEX_ALL,
          params: encodeParams(paramsObj)
        },
        index: idx
      }
    })

    // Partitionner cache hits / misses
    const hits: Array<{ index: number, data: any }> = []
    const misses: BuiltReq[] = []
    built.forEach(b => {
      const c = getCache(b.cacheKey)
      if (c) hits.push({ index: b.index, data: c })
      else misses.push(b)
    })

    // Préparer les headers Algolia
    const algoliaHeaders = {
      'X-Algolia-API-Key': ALGOLIA_ADMIN_KEY,
      'X-Algolia-Application-Id': ALGOLIA_APP_ID,
      'Content-Type': 'application/json'
    }

    let remoteResults: Array<any> = []
    if (misses.length > 0) {
      const multiUrl = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/*/queries`
      const multiBody = { requests: misses.map(m => m.body) }
      const response = await fetch(multiUrl, {
        method: 'POST',
        headers: algoliaHeaders,
        body: JSON.stringify(multiBody)
      })
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Algolia multi-queries error:', errorText)
        return jsonResponse(500, { error: 'Search failed', details: errorText }, origin)
      }
      const multiJson = await response.json()
      // multiJson.results est un array aligné sur misses
      remoteResults = (multiJson?.results || [])
      // mettre en cache
      remoteResults.forEach((res: any, i: number) => {
        const miss = misses[i]
        if (miss) setCache(miss.cacheKey, res)
      })
    }

    // Reconstituer l'ordre original
    const assembled: Array<any> = new Array(incomingRequests.length)
    // placer les hits cache
    hits.forEach(h => assembled[h.index] = h.data)
    // placer les misses dans l'ordre des misses
    let k = 0
    for (let i = 0; i < built.length; i++) {
      if (assembled[i]) continue
      assembled[i] = remoteResults[k++] || { hits: [], nbHits: 0, page: 0, nbPages: 0, hitsPerPage: Number(incomingRequests[i]?.hitsPerPage || 20) }
    }

    // Compatibilité: si la requête initiale n'était pas batch, retourner objet simple
    if (!isBatch) {
      return jsonResponse(200, assembled[0] || { hits: [], nbHits: 0, page: 0, nbPages: 0, hitsPerPage: Number(incomingRequests[0]?.hitsPerPage || 20) }, origin)
    }

    return jsonResponse(200, { results: assembled }, origin)

  } catch (error) {
    console.error('Proxy error:', error)
    const origin = req.headers.get('Origin')
    return jsonResponse(500, { error: 'Internal server error', details: String(error) }, origin)
  }
})
