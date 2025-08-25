// @ts-nocheck
/**
 * ALGOLIA SEARCH PROXY - Architecture de recherche unifiée
 * 
 * Cette Edge Function optimise les requêtes de recherche en :
 * - Unification des requêtes : UNE SEULE requête Algolia par recherche
 * - Gestion sécurisée du blur/teaser côté serveur
 * - Support des origines : 'public' (base commune) et 'private' (base personnelle)
 * - Validation des 3 caractères minimum
 * 
 * FLUX DE DONNÉES :
 * 1. Frontend envoie { query, origin: 'public'|'private' }
 * 2. Validation côté serveur (3 caractères minimum)
 * 3. Construction requête Algolia unifiée avec facetFilters sécurisés
 * 4. Post-traitement pour blur/teaser selon assignations workspace
 * 5. Réponse avec flag is_blurred pour éléments premium non-assignés
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// Cache TTL (ms) pour les requêtes identiques
const CACHE_TTL_MS = Number(Deno.env.get('ALGOLIA_CACHE_TTL_MS')) || 30000;

// Cache simple en mémoire (limité à la durée de vie de l'instance)
const cache = new Map<string, { data: any; timestamp: number }>();

/**
 * CONFIGURATION TEASER/BLUR - Sécurité côté serveur
 * 
 * Attributs visibles dans le teaser (utilisateurs sans assignation premium)
 */
const TEASER_ATTRIBUTES = [
  'objectID', 'scope', 'languages', 'access_level', 'Source', 'Date',
  'Nom_fr', 'Secteur_fr', 'Sous-secteur_fr', 'Localisation_fr', 'Périmètre_fr',
  'Nom_en', 'Secteur_en', 'Sous-secteur_en', 'Localisation_en', 'Périmètre_en',
  'Description_fr', 'Description_en', 'Commentaires_fr', 'Commentaires_en',
  'Incertitude', 'Contributeur', 'Unite_fr', 'Unite_en', 'FE'
];

/**
 * Attributs sensibles masqués dans le teaser
 */
const SENSITIVE_ATTRIBUTES = [
  'FE', 'Incertitude', 'Commentaires_fr', 'Commentaires_en', 
  'Unite_fr', 'Unite_en', 'Description_fr', 'Description_en'
];

/**
 * Validation de la requête - Règle des 3 caractères minimum
 * Cette validation côté serveur empêche les requêtes Algolia vides/courtes
 * EXCEPTION: Permet les requêtes avec facettes pour initialiser les filtres
 */
function validateQuery(query: string, request: any): { valid: boolean; message?: string } {
  const trimmed = (query || '').trim();
  
  // Permettre les requêtes avec facettes même sans query (pour initialiser les filtres)
  const hasFacets = Array.isArray(request?.facets) && request.facets.length > 0;
  const hasFilters = request?.filters || request?.facetFilters;
  
  if (trimmed.length < 3 && !hasFacets && !hasFilters) {
    return { 
      valid: false, 
      message: 'Minimum 3 caractères requis pour la recherche' 
    };
  }
  return { valid: true };
}

/**
 * Post-traitement sécurisé des résultats Algolia
 * Applique le blur/teaser selon les assignations workspace
 */
function postProcessResults(results: any[], hasWorkspaceAccess: boolean, assignedSources: string[] = []): any[] {
  return results.map(hit => {
    const isPremium = hit.access_level === 'premium';
    const isSourceAssigned = assignedSources.includes(hit.Source);
    const shouldBlur = isPremium && !isSourceAssigned;
    
    if (shouldBlur) {
      // Créer une copie avec seulement les attributs du teaser
      const teaserHit = { ...hit };
      SENSITIVE_ATTRIBUTES.forEach(attr => delete teaserHit[attr]);
      teaserHit.is_blurred = true;
      return teaserHit;
    }
    
    return { ...hit, is_blurred: false };
  });
}

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
  const it = cache.get(key);
  if (!it) return null;
  if (Date.now() - it.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return it.data;
}

function setCache(key: string, data: any): void {
  cache.set(key, { timestamp: Date.now(), data });
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
    // Utiliser les noms de secrets Supabase
    const ALGOLIA_APP_ID = Deno.env.get('ALGOLIA_APP_ID')!
    const ALGOLIA_ADMIN_KEY = Deno.env.get('ALGOLIA_ADMIN_KEY')!
    const ALGOLIA_INDEX_ALL = Deno.env.get('ALGOLIA_INDEX_ALL') || 'ef_all'
    
    // Debug des variables d'environnement
    if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) {
      console.error('Missing Algolia credentials:', { 
        hasAppId: !!ALGOLIA_APP_ID, 
        hasAdminKey: !!ALGOLIA_ADMIN_KEY 
      });
      return jsonResponse(500, { error: 'Missing Algolia credentials' }, req.headers.get('Origin'))
    }

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

    // Récupérer le workspace et les sources assignées de l'utilisateur
    let workspaceId: string | null = null
    let assignedSources: string[] = []
    if (userId) {
      const { data: userRow } = await supabase
        .from('users')
        .select('workspace_id')
        .eq('user_id', userId)
        .single()
      workspaceId = userRow?.workspace_id ?? null
      
      // Récupérer les sources premium assignées au workspace
      if (workspaceId) {
        const { data: sourcesData } = await supabase
          .from('fe_source_workspace_assignments')
          .select('source_name')
          .eq('workspace_id', workspaceId)
        assignedSources = sourcesData?.map(s => s.source_name) || []
      }
    }

    /**
     * Construction unifiée des requêtes Algolia selon l'origine
     * 
     * ORIGINE 'public' (Base commune):
     * - Scope: public uniquement
     * - Access: standard (toujours) + premium si assigné au workspace
     * - Teaser: si pas d'assignation workspace, retourne attributs limités
     * 
     * ORIGINE 'private' (Base personnelle):
     * - Scope: private uniquement  
     * - Workspace: filtré selon workspace_id de l'utilisateur
     * - Pas de teaser: accès complet aux données du workspace
     */
    const buildUnified = (originParam: 'public'|'private'|undefined) => {
      // Nettoyer les paramètres legacy
      const origin = originParam || 'public' // Plus de support 'fullPrivate'
      let appliedFilters = ''
      let appliedFacetFilters: any[] = []
      let attributesToRetrieve: string[] | undefined
      
      if (origin === 'public') {
        appliedFilters = `scope:public`
        if (workspaceId) {
          // Workspace authentifié: standard + premium assigné
          appliedFacetFilters = [[ 'access_level:standard', `assigned_workspace_ids:${workspaceId}` ]]
          attributesToRetrieve = undefined // Accès complet
        } else {
          // Utilisateur non-authentifié: standard + premium (teaser)
          appliedFacetFilters = [[ 'access_level:standard', 'access_level:premium' ]]
          attributesToRetrieve = TEASER_ATTRIBUTES // Teaser seulement
        }
      } else {
        // private: données du workspace uniquement
        if (!userId) {
          appliedFilters = `scope:private AND workspace_id:_none_` // Pas d'accès sans auth
        } else {
          appliedFilters = workspaceId
            ? `scope:private AND workspace_id:${workspaceId}`
            : `scope:private AND workspace_id:_none_`
        }
        attributesToRetrieve = undefined // Accès complet aux données du workspace
      }
      return { appliedFilters, appliedFacetFilters, attributesToRetrieve }
    }

    // Validation stricte: 3 caractères minimum sauf quand facettes/filters présents

    // Construire les requêtes Algolia (multi)
    type BuiltReq = {
      cacheKey: string,
      body: any,
      index: number
    }
    const built: BuiltReq[] = incomingRequests.map((r: any, idx: number) => {
      const {
        query,
        filters,
        facetFilters,
        facets,
        maxValuesPerFacet,
        sortFacetValuesBy,
        maxFacetHits,
        ruleContexts,
        origin: reqOrigin,
        searchType,
        hitsPerPage,
        page,
        attributesToRetrieve: attrsClient,
        restrictSearchableAttributes
      } = r || {}
      const { appliedFilters, appliedFacetFilters, attributesToRetrieve } = buildUnified(
        (reqOrigin as 'public'|'private'|undefined)
      )
      const validation = validateQuery(String(query || ''), { facets, filters, facetFilters })
      if (!validation.valid) {
        return jsonResponse(200, { hits: [], nbHits: 0, page: 0, nbPages: 0, hitsPerPage: Number(hitsPerPage || 20), message: validation.message }, origin)
      }
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
        ...(facets ? { facets } : {}),
        ...(typeof maxValuesPerFacet === 'number' ? { maxValuesPerFacet } : {}),
        ...(sortFacetValuesBy ? { sortFacetValuesBy } : {}),
        ...(typeof maxFacetHits === 'number' ? { maxFacetHits } : {}),
        ...(Array.isArray(ruleContexts) ? { ruleContexts } : {}),
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
      
      // Post-traitement sécurisé: appliquer le blur/teaser selon les assignations
      remoteResults = remoteResults.map((result: any) => {
        if (result?.hits) {
          const processedHits = postProcessResults(
            result.hits, 
            !!workspaceId, 
            assignedSources
          )
          return { ...result, hits: processedHits }
        }
        return result
      })
      
      // mettre en cache (après post-traitement)
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
