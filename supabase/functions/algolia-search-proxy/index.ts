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
// @ts-ignore Deno runtime types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

// ============================================
// TYPES & INTERFACES
// ============================================

type Origin = 'public' | 'private';

interface ValidationResult {
  valid: boolean;
  message?: string;
}

interface SearchRequest {
  params?: SearchParams;
  origin?: Origin;
  [key: string]: unknown;
}

interface SearchParams {
  query?: string;
  filters?: string;
  facetFilters?: unknown;
  facets?: string[];
  maxValuesPerFacet?: number;
  sortFacetValuesBy?: string;
  maxFacetHits?: number;
  ruleContexts?: string[];
  searchType?: string;
  hitsPerPage?: number;
  page?: number;
  attributesToRetrieve?: string[];
  attributesToHighlight?: string[];
  restrictSearchableAttributes?: string[];
  origin?: Origin;
}

interface AlgoliaHit {
  Source: string;
  access_level?: 'public' | 'premium' | 'paid';
  FE?: number;
  is_blurred?: boolean;
  [key: string]: unknown;
}

interface AlgoliaSearchResponse {
  hits: AlgoliaHit[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
  processingTimeMS?: number;
  query?: string;
  params?: string;
  facets?: Record<string, Record<string, number>>;
  [key: string]: unknown;
}

interface AlgoliaMultiResponse {
  results: AlgoliaSearchResponse[];
}

interface AlgoliaRequestBody {
  indexName: string;
  params: string;
}

interface UnifiedParams {
  appliedFilters: string;
  appliedFacetFilters: unknown[];
  attributesToRetrieve: string[] | undefined;
}

interface JWTPayload {
  sub: string;
  [key: string]: unknown;
}

// CACHE DÉSACTIVÉ : Le cache par instance créait des inconsistances
// Algolia a déjà son propre cache, pas besoin d'ajouter une couche supplémentaire

/**
 * CONFIGURATION TEASER/BLUR - Sécurité côté serveur
 * 
 * Attributs visibles dans le teaser (utilisateurs sans assignation premium)
 */
// Pour les utilisateurs non-authentifiés, on ne limite PAS les attributs retournés
// Tous les champs sont visibles (Description, Commentaires, Unite, Incertitude, etc.)
// SEUL le champ FE (facteur d'émission) est masqué pour les sources paid non-assignées
const TEASER_ATTRIBUTES = undefined; // Pas de restriction, on retourne tous les attributs

/**
 * Attribut sensible masqué pour les sources premium non-assignées
 * UNIQUEMENT le champ FE (valeur du facteur d'émission) doit être blurré
 */
const SENSITIVE_ATTRIBUTES = ['FE'];

/**
 * Validation de la requête - Règle des 3 caractères minimum
 * Cette validation côté serveur empêche les requêtes Algolia vides/courtes
 * EXCEPTION: Permet les requêtes avec facettes pour initialiser les filtres
 */
function validateQuery(query: string, request: SearchRequest): ValidationResult {
  const trimmed = (query || '').trim();
  
  // Permettre les requêtes avec facettes même sans query (pour initialiser les filtres)
  const params = request?.params || request;
  const hasFacets = Array.isArray(params?.facets) && params.facets.length > 0;
  const hasFilters = params?.filters || params?.facetFilters;
  
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
function postProcessResults(results: AlgoliaHit[], hasWorkspaceAccess: boolean, assignedSources: string[] = []): AlgoliaHit[] {
  return results.map(hit => {
    // Vérifier si c'est une source payante (premium ou paid)
    const isPaid = hit.access_level === 'premium' || hit.access_level === 'paid';
    const isSourceAssigned = assignedSources.includes(hit.Source);
    const shouldBlur = isPaid && !isSourceAssigned;
    
    if (shouldBlur) {
      // Créer une copie et supprimer UNIQUEMENT le champ FE
      const blurredHit = { ...hit };
      SENSITIVE_ATTRIBUTES.forEach(attr => delete blurredHit[attr]); // Supprime uniquement 'FE'
      blurredHit.is_blurred = true;
      return blurredHit;
    }
    
    return { ...hit, is_blurred: false };
  });
}

function encodeParams(params: Record<string, unknown>): string {
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

function jsonResponse(status: number, data: unknown, origin?: string | null): Response {
  const headers: Record<string, string> = { ...corsHeaders, 'Content-Type': 'application/json' }
  if (origin) headers['Access-Control-Allow-Origin'] = origin
  return new Response(JSON.stringify(data), { status, headers })
}

// @ts-ignore Deno runtime
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' })
  }

  try {
    // @ts-ignore Deno.env
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    // @ts-ignore Deno.env
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    // @ts-ignore Deno.env
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    // Utiliser les noms de secrets Supabase
    // @ts-ignore Deno.env
    const ALGOLIA_APP_ID = Deno.env.get('ALGOLIA_APP_ID')!
    // @ts-ignore Deno.env
    const ALGOLIA_ADMIN_KEY = Deno.env.get('ALGOLIA_ADMIN_KEY')!
    // @ts-ignore Deno.env
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
    // IMPORTANT: Utiliser SERVICE_ROLE_KEY pour contourner RLS lors de la lecture de la table users
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    let userId: string | null = null
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      
      console.log('[algolia-search-proxy] Validating JWT (optional)')
      
      // Décoder le JWT pour obtenir le payload (sans vérification de signature)
      try {
        const parts = token.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as JWTPayload
          const extractedUserId = payload.sub
          
          if (extractedUserId) {
            // Valider que l'utilisateur existe en utilisant l'admin API
            const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(extractedUserId)
            
            if (!authError && authUser?.user) {
              userId = authUser.user.id
              console.log('[algolia-search-proxy] User authenticated:', userId)
            } else {
              console.warn('[algolia-search-proxy] User validation failed:', authError)
            }
          }
        }
      } catch (error) {
        console.warn('[algolia-search-proxy] Failed to decode JWT (continuing as anonymous):', error)
      }
    }

    // Récupérer le body de la requête
    const rawBody = await req.json() as { requests?: SearchRequest[] } | SearchRequest
    const isBatch = Array.isArray((rawBody as { requests?: SearchRequest[] }).requests)
    const incomingRequests: SearchRequest[] = isBatch ? (rawBody as { requests: SearchRequest[] }).requests : [rawBody as SearchRequest]

    // Récupérer le workspace et les sources assignées de l'utilisateur
    let workspaceId: string | null = null
    let assignedSources: string[] = []
    if (userId) {
      const { data: userRow } = await supabaseAdmin
        .from('users')
        .select('workspace_id')
        .eq('user_id', userId)
        .single()
      
      workspaceId = userRow?.workspace_id ?? null
      
      // Récupérer les sources premium assignées au workspace
      if (workspaceId) {
        const { data: sourcesData } = await supabaseAdmin
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
    const buildUnified = (originParam: Origin | undefined, searchTypeParam?: string): UnifiedParams => {
      // Nettoyer les paramètres legacy
      const origin = originParam || 'public' // Plus de support 'fullPrivate'
      let appliedFilters = ''
      let appliedFacetFilters: unknown[] = []
      let attributesToRetrieve: string[] | undefined
      
      if (origin === 'public') {
        appliedFilters = `scope:public`
        // IMPORTANT: Ne pas appliquer de facetFilters pour le scope public
        // Le blurring des sources premium se fait dans postProcessResults
        appliedFacetFilters = []
        attributesToRetrieve = undefined // Accès complet à tous les attributs
      } else {
        // private: données du workspace uniquement
        // scope via filters (filterOnly), workspace_id via facetFilters (UUID)
        appliedFilters = 'scope:private'
        if (!userId) {
          // Pas d'accès sans auth: filtre impossible à matcher
          appliedFacetFilters = [[ 'workspace_id:_none_' ]]
        } else {
          // Filtre par workspace_id via facetFilters (supporte les UUIDs)
          appliedFacetFilters = workspaceId
            ? [[ `workspace_id:${workspaceId}` ]]
            : [[ 'workspace_id:_none_' ]]
        }
        attributesToRetrieve = undefined // Accès complet aux données du workspace
      }
      return { appliedFilters, appliedFacetFilters, attributesToRetrieve }
    }

    // Validation supprimée: permettre les requêtes vides/courtes pour initialiser les facettes

    // Construire les requêtes Algolia (multi)
    const built = incomingRequests.map((r: SearchRequest, idx: number) => {
      const params = r?.params || r || {}
      const reqOrigin = (r?.origin || (params as SearchParams)?.origin) as Origin | undefined
      const {
        query,
        filters,
        facetFilters,
        facets,
        maxValuesPerFacet,
        sortFacetValuesBy,
        maxFacetHits,
        ruleContexts,
        searchType,
        hitsPerPage,
        page,
        attributesToRetrieve: attrsClient,
        attributesToHighlight,
        restrictSearchableAttributes
      } = params
      const { appliedFilters, appliedFacetFilters, attributesToRetrieve } = buildUnified(
        reqOrigin, String(searchType || '')
      )
      
      // DEBUG: Log pour diagnostiquer le filtrage
      if (reqOrigin === 'private') {
        console.log('[DEBUG] Private search:', { 
          userId, 
          workspaceId, 
          appliedFilters, 
          appliedFacetFilters: JSON.stringify(appliedFacetFilters)
        })
      }
      const combinedFilters = filters ? `(${appliedFilters}) AND (${filters})` : appliedFilters
      let combinedFacetFilters: unknown[] = [...appliedFacetFilters]
      if (facetFilters) {
        if (Array.isArray(facetFilters)) combinedFacetFilters = [...combinedFacetFilters, ...facetFilters]
        else combinedFacetFilters.push(facetFilters)
      }
      const paramsObj: Record<string, unknown> = {
        query: query || '',
        filters: combinedFilters,
        facetFilters: combinedFacetFilters.length > 0 ? combinedFacetFilters : undefined,
        ...(attributesToRetrieve ? { attributesToRetrieve } : (attrsClient ? { attributesToRetrieve: attrsClient } : {})),
        ...(typeof hitsPerPage === 'number' ? { hitsPerPage } : {}),
        ...(typeof page === 'number' ? { page } : {}),
        ...(restrictSearchableAttributes ? { restrictSearchableAttributes } : {}),
        ...(facets ? { facets } : {}),
        maxValuesPerFacet: typeof maxValuesPerFacet === 'number' ? maxValuesPerFacet : 1500, // Défaut à 1500 pour couvrir toutes les facettes (notamment Localisation_fr: 1395 valeurs)
        ...(sortFacetValuesBy ? { sortFacetValuesBy } : {}),
        ...(typeof maxFacetHits === 'number' ? { maxFacetHits } : {}),
        ...(Array.isArray(ruleContexts) ? { ruleContexts } : {}),
        ...(Array.isArray(attributesToHighlight) && attributesToHighlight.length > 0 ? { attributesToHighlight } : {}),
        // Balises de highlight attendues par React InstantSearch
        highlightPreTag: '__ais-highlight__',
        highlightPostTag: '__/ais-highlight__'
      }
      return {
        body: {
          indexName: ALGOLIA_INDEX_ALL,
          params: encodeParams(paramsObj)
        },
        index: idx
      }
    })


    // Préparer les headers Algolia
    const algoliaHeaders = {
      'X-Algolia-API-Key': ALGOLIA_ADMIN_KEY,
      'X-Algolia-Application-Id': ALGOLIA_APP_ID,
      'Content-Type': 'application/json'
    }

    // Effectuer la requête Algolia (sans cache pour garantir la consistance)
    const multiUrl = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/*/queries`
    const multiBody = { requests: built.map(b => b.body) }
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
    
    const multiJson = await response.json() as AlgoliaMultiResponse
    let results = (multiJson?.results || [])
    
    // Post-traitement sécurisé: appliquer le blur/teaser selon les assignations
    // IMPORTANT: On DOIT préserver TOUS les champs du result Algolia (facets, nbHits, etc.)
    results = results.map((result: AlgoliaSearchResponse) => {
      if (result?.hits) {
        const processedHits = postProcessResults(
          result.hits, 
          !!workspaceId, 
          assignedSources
        )
        // Retourner le result original avec les hits processés (préserve facets, nbHits, etc.)
        return {
          ...result, 
          hits: processedHits
        }
      }
      return result
    })

    // Compatibilité: si la requête initiale n'était pas batch, retourner objet simple
    if (!isBatch) {
      const firstParams = incomingRequests[0]?.params || incomingRequests[0] || {}
      const hitsPerPage = Number((firstParams as SearchParams).hitsPerPage || 20)
      return jsonResponse(200, results[0] || { hits: [], nbHits: 0, page: 0, nbPages: 0, hitsPerPage }, origin)
    }

    return jsonResponse(200, { results }, origin)

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Proxy error:', errorMessage)
    const origin = req.headers.get('Origin')
    return jsonResponse(500, { error: 'Internal server error', details: errorMessage }, origin)
  }
})
