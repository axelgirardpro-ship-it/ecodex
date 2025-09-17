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

// Cache TTL (ms) pour les requêtes identiques (version stable)
const CACHE_TTL_MS = Number(Deno.env.get('EDGE_CACHE_TTL_MS') ?? '3000');
type CacheEntry = { ts: number; data: any };
const cacheStore = new Map<string, CacheEntry>();

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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
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
    const admin = SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null

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
    
    // DEBUG: Voir ce qui est reçu côté proxy
    console.log('DEBUG Proxy received:', { 
      userId, 
      isBatch, 
      firstRequest: incomingRequests[0],
      workspaceIdFromContext: incomingRequests[0]?._search_context?.workspace_id,
      workspaceIdDirect: incomingRequests[0]?.workspace_id
    })

    // Récupérer le workspace avec fallback (users -> user_roles)
    let workspaceId: string | null = null
    if (userId) {
      try {
        // Forcer l'usage du service role pour contourner RLS
        const client = admin || supabase
        const { data: userRow, error: userErr } = await client
          .from('users')
          .select('workspace_id')
          .eq('user_id', userId)
          .single()
        
        if (!userErr && userRow?.workspace_id) {
          workspaceId = userRow.workspace_id
        } else {
          const { data: roleRow, error: roleErr } = await client
            .from('user_roles')
            .select('workspace_id')
            .eq('user_id', userId)
            .limit(1)
            .single()
          
          if (!roleErr && roleRow?.workspace_id) {
            workspaceId = roleRow.workspace_id
          }
        }
      } catch (e) {
        console.error('Workspace resolution error:', e)
      }
    }
    

    // Si toujours nul, tenter de lire un workspace_id proposé par le client (contexte)
    // et le valider contre user_roles pour éviter l'usurpation
    if (!workspaceId && userId) {
      let candidateWorkspaceId: string | null = null
      for (const r of incomingRequests) {
        const cand = r?._search_context?.workspace_id || r?.workspace_id
        if (typeof cand === 'string' && cand.length >= 36) {
          candidateWorkspaceId = cand
          break
        }
      }
      if (candidateWorkspaceId && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(candidateWorkspaceId)) {
        try {
          const { data: roleRow, error: roleErr } = await supabase
            .from('user_roles')
            .select('workspace_id')
            .eq('user_id', userId)
            .eq('workspace_id', candidateWorkspaceId)
            .limit(1)
            .single()
          if (!roleErr && roleRow?.workspace_id) {
            workspaceId = roleRow.workspace_id
          }
        } catch {}
      }
    }

    // Récupérer les sources assignées au workspace (pour le blur côté public)
    let assignedSources: string[] = []
    if (workspaceId) {
      try {
        const { data: assignRows } = await (admin || supabase)
          .from('fe_source_workspace_assignments')
          .select('source_name')
          .eq('workspace_id', workspaceId)
        assignedSources = (assignRows || []).map((r: any) => r?.source_name).filter((s: any) => typeof s === 'string')
      } catch {}
    }

    // Utilitaire UUID
    const isUuid = (v: any) => typeof v === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v)

    /**
     * Construction unifiée des requêtes Algolia selon l'origine
     * Accepte un workspaceId effectif par requête (priorité: requête -> serveur)
     */
    const buildApplied = (searchType: string, reqWorkspaceId: string | null) => {
      const ws = isUuid(reqWorkspaceId) ? reqWorkspaceId : null
      let appliedFilters = ''
      let appliedFacetFilters: any[] = []
      switch (searchType) {
        case 'fullPublic':
          appliedFilters = `scope:public`
          if (ws) appliedFacetFilters = [[ 'access_level:standard', `assigned_workspace_ids:"${ws}"` ]]
          else appliedFacetFilters = [[ 'access_level:standard' ]]
          break
        case 'teaserPublic':
          appliedFilters = `scope:public`
          appliedFacetFilters = [[ 'access_level:premium' ]]
          break
        case 'fullPrivate':
          if (!userId) appliedFilters = `scope:private AND workspace_id:_none_`
          else appliedFilters = ws ? `scope:private AND workspace_id:"${ws}"` : `scope:private AND workspace_id:_none_`
          break
        default:
          appliedFilters = `scope:public`
          if (ws) appliedFacetFilters = [[ 'access_level:standard', `assigned_workspace_ids:"${ws}"` ]]
          else appliedFacetFilters = [[ 'access_level:standard' ]]
      }
      return { appliedFilters, appliedFacetFilters }
    }

    // Construire les requêtes Algolia (multi)
    type BuiltReq = {
      cacheKey: string,
      body: any,
      index: number
    }
    const built: BuiltReq[] = incomingRequests.map((r: any, idx: number) => {
      const { query, filters, facetFilters, searchType, origin: originParam, ...otherParams } = r || {}
      const effectiveType = String(searchType || (originParam === 'private' ? 'fullPrivate' : 'fullPublic'))

      // Workspace effectif calculé
      let requestWorkspaceId: string | null = workspaceId
      const candidates = [ r?.workspace_id, r?.params?.workspace_id, r?.params?._search_context?.workspace_id, r?._search_context?.workspace_id ]
      for (const cand of candidates) { if (isUuid(cand)) { requestWorkspaceId = cand; break } }

      // Le client a-t-il déjà fourni un filtre workspace_id ?
      const clientHasWsFilter = typeof filters === 'string' && /workspace_id\s*:\s*\"?[0-9a-fA-F-]{36}\"?/i.test(filters)

      // En recherche privée: si le client n'a pas fourni de filtre ws et qu'aucun ws ne peut être résolu, renvoyer 400
      if (effectiveType === 'fullPrivate' && !clientHasWsFilter && !requestWorkspaceId) {
        throw new Error('MISSING_WORKSPACE_ID')
      }

      // Construire applied selon présence d'un filtre ws côté client
      const buildAppliedFor = (stype: string): { appliedFilters: string, appliedFacetFilters: any[] } => {
        let appliedFilters = ''
        let appliedFacetFilters: any[] = []
        switch (stype) {
          case 'fullPublic':
            appliedFilters = `scope:public`
            if (requestWorkspaceId) appliedFacetFilters = [[ 'access_level:standard', `assigned_workspace_ids:\"${requestWorkspaceId}\"` ]]; else appliedFacetFilters = [[ 'access_level:standard' ]]
            break
          case 'teaserPublic':
            appliedFilters = `scope:public`
            appliedFacetFilters = [[ 'access_level:premium' ]]
            break
          case 'fullPrivate':
            // Si le client a déjà mis workspace_id dans filters, on force juste scope:private sans ajouter _none_
            if (clientHasWsFilter) {
              appliedFilters = `scope:private`
            } else {
              appliedFilters = `scope:private AND workspace_id:\"${requestWorkspaceId}\"`
            }
            break
          default:
            appliedFilters = `scope:public`
            if (requestWorkspaceId) appliedFacetFilters = [[ 'access_level:standard', `assigned_workspace_ids:\"${requestWorkspaceId}\"` ]]; else appliedFacetFilters = [[ 'access_level:standard' ]]
        }
        return { appliedFilters, appliedFacetFilters }
      }

      const { appliedFilters, appliedFacetFilters } = buildAppliedFor(effectiveType)
      const combinedFilters = filters ? `(${appliedFilters}) AND (${filters})` : appliedFilters
      let combinedFacetFilters: any[] = [...appliedFacetFilters]
      if (facetFilters) { if (Array.isArray(facetFilters)) combinedFacetFilters = [...combinedFacetFilters, ...facetFilters]; else combinedFacetFilters.push(facetFilters) }

      // Le tri côté client est supprimé. On utilise toujours l'index par défaut côté Algolia.
      const targetIndexName = ALGOLIA_INDEX_ALL

      const paramsObjRaw: Record<string, any> = { query: query || '', filters: combinedFilters, facetFilters: combinedFacetFilters.length > 0 ? combinedFacetFilters : undefined, ...otherParams }
      const { _search_context: _ctxIgnored, origin: _originIgnored, workspace_id: _wsParamIgnored, ...paramsObj } = paramsObjRaw
      const cacheKey = JSON.stringify({ requestWorkspaceId, searchType: effectiveType, indexName: targetIndexName, params: paramsObj })
      return { cacheKey, body: { indexName: targetIndexName, params: encodeParams(paramsObj) }, index: idx }
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

  } catch (error) { const origin = req.headers.get('Origin'); const msg = String((error as any)?.message || error);
    if (msg.includes('MISSING_WORKSPACE_ID')) {
      return jsonResponse(400, { error: 'workspace_id requis pour la recherche privée' }, origin)
    }
    return jsonResponse(500, { error: 'Internal server error', details: String(error) }, origin) }
})
