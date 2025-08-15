import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

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
    
    // Vérifier l'authentification
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse(401, { error: 'Authorization header required' }, origin)
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return jsonResponse(401, { error: 'Invalid authentication' }, origin)
    }

    // Récupérer le body de la requête
    const { query, filters, facetFilters, searchType, ...otherParams } = await req.json()

    // Récupérer le workspace de l'utilisateur
    const { data: profile } = await supabase
      .from('profiles')
      .select('workspace_id')
      .eq('id', user.id)
      .single()

    const workspaceId = profile?.workspace_id

    // Séparer les filtres en filters (pour les champs simples) et facetFilters (pour les facettes)
    let appliedFilters = ''
    let appliedFacetFilters: any[] = []
    
    switch (searchType) {
      case 'fullPublic':
        appliedFilters = `scope:public`
        if (workspaceId) {
          // Pour fullPublic avec workspace : standard OU premium assigné à ce workspace
          appliedFacetFilters = [
            ['access_level:standard', `assigned_workspace_ids:${workspaceId}`]
          ]
        } else {
          // Sans workspace : seulement standard
          appliedFacetFilters = [['access_level:standard']]
        }
        break
      
      case 'fullPrivate':
        appliedFilters = workspaceId
          ? `scope:private AND workspace_id:${workspaceId}`
          : `scope:private AND workspace_id:_none_`
        break
      
      case 'teaserPublic':
        appliedFilters = `scope:public`
        appliedFacetFilters = [['access_level:premium']]
        break
      
      default:
        // Par défaut, recherche publique standard
        appliedFilters = `scope:public`
        if (workspaceId) {
          appliedFacetFilters = [
            ['access_level:standard', `assigned_workspace_ids:${workspaceId}`]
          ]
        } else {
          appliedFacetFilters = [['access_level:standard']]
        }
    }

    // Combiner avec les filtres passés par le client
    const combinedFilters = filters ? `(${appliedFilters}) AND (${filters})` : appliedFilters
    
    // Combiner les facetFilters du proxy avec ceux du client
    let combinedFacetFilters = [...appliedFacetFilters]
    if (facetFilters) {
      if (Array.isArray(facetFilters)) {
        combinedFacetFilters = [...combinedFacetFilters, ...facetFilters]
      } else {
        combinedFacetFilters.push(facetFilters)
      }
    }

    // Préparer les headers Algolia
    const algoliaHeaders = {
      'X-Algolia-API-Key': ALGOLIA_ADMIN_KEY,
      'X-Algolia-Application-Id': ALGOLIA_APP_ID,
      'Content-Type': 'application/json'
    }

    // Construire le body de la requête Algolia
    const algoliaBody = {
      query: query || '',
      filters: combinedFilters,
      facetFilters: combinedFacetFilters.length > 0 ? combinedFacetFilters : undefined,
      ...otherParams
    }

    // Debug logging
    console.log('🔍 Algolia Search Proxy:', {
      searchType,
      workspaceId,
      userId: user.id,
      filters: combinedFilters,
      facetFilters: combinedFacetFilters,
      query: query || '[empty]'
    })

    // Pour les recherches teaser, limiter les attributs retournés
    if (searchType === 'teaserPublic') {
      algoliaBody.attributesToRetrieve = [
        'objectID', 'scope', 'languages', 'access_level', 'Source', 'Date',
        'Nom_fr','Secteur_fr','Sous-secteur_fr','Localisation_fr','Périmètre_fr',
        'Nom_en','Secteur_en','Sous-secteur_en','Localisation_en','Périmètre_en'
      ]
    }

    // Faire la requête à Algolia
    const searchUrl = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX_ALL}/query`
    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: algoliaHeaders,
      body: JSON.stringify(algoliaBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Algolia search error:', errorText)
      return jsonResponse(500, { error: 'Search failed', details: errorText }, origin)
    }

    const searchResults = await response.json()
    
    return jsonResponse(200, searchResults, origin)

  } catch (error) {
    console.error('Proxy error:', error)
    const origin = req.headers.get('Origin')
    return jsonResponse(500, { error: 'Internal server error', details: String(error) }, origin)
  }
})
