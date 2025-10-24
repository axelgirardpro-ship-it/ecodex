// Edge Function: generate-benchmark
// Version: 1.1.1 - FEATURE: Allow benchmark generation without search query (filters only)
// @ts-nocheck - This is a Deno Edge Function
// TODO Phase 2: Remplacer @ts-nocheck par des types appropriés
// Ce fichier nécessite des interfaces TypeScript pour :
// - Les réponses Algolia (hits, facets, pagination)
// - Les structures de benchmark (BenchmarkItem, BenchmarkData)
// - Les réponses Supabase (benchmarks, workspaces)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status: number, data: any) {
  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };
  return new Response(JSON.stringify(data), { status, headers });
}

// Calculs statistiques
function calculateStatistics(values: number[]) {
  if (values.length === 0) return null;
  
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  
  const median = n % 2 === 0 
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 
    : sorted[Math.floor(n / 2)];
  
  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  
  const mean = values.reduce((sum, v) => sum + v, 0) / n;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  const standardDeviation = Math.sqrt(variance);
  
  const min = sorted[0];
  const max = sorted[n - 1];
  const iqr = q3 - q1;
  const percentRange = ((max - min) / min) * 100;
  
  return {
    sampleSize: n,
    median,
    q1,
    q3,
    min,
    max,
    mean,
    standardDeviation,
    iqr,
    percentRange,
  };
}

// Fonction pour appeler l'API Algolia directement
async function algoliaSearch(appId: string, apiKey: string, indexName: string, params: any) {
  const url = `https://${appId}-dsn.algolia.net/1/indexes/${indexName}/query`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-Algolia-Application-Id': appId,
      'X-Algolia-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ params: encodeParams(params) }),
  });

  if (!response.ok) {
    throw new Error(`Algolia search failed: ${response.statusText}`);
  }

  return await response.json();
}

// Encoder les paramètres Algolia
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ALGOLIA_APP_ID = Deno.env.get('ALGOLIA_APP_ID')!;
    const ALGOLIA_ADMIN_KEY = Deno.env.get('ALGOLIA_ADMIN_KEY')!;
    const ALGOLIA_INDEX_ALL = Deno.env.get('ALGOLIA_INDEX_ALL') || 'ef_all';

    // Auth - Créer le client et valider le JWT
    console.log('[generate-benchmark] Starting authentication');
    
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const authHeader = req.headers.get('authorization');
    console.log('[generate-benchmark] Auth header present:', !!authHeader);
    
    if (!authHeader) {
      console.error('[generate-benchmark] No auth header');
      return jsonResponse(401, { error: 'Authorization required' });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('[generate-benchmark] Token length:', token.length);
    console.log('[generate-benchmark] Token starts with:', token.substring(0, 20));
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    console.log('[generate-benchmark] getUser result:', { hasUser: !!user, hasError: !!authError });
    
    if (authError) {
      console.error('[generate-benchmark] Auth error:', authError.message, authError.status);
      return jsonResponse(401, { 
        error: 'Invalid or expired token',
        details: authError.message 
      });
    }
    
    if (!user) {
      console.error('[generate-benchmark] No user found');
      return jsonResponse(401, { error: 'Invalid or expired token' });
    }

    const userId = user.id;
    console.log('✅ User authenticated:', userId);

    // Créer un client admin pour les requêtes privilégiées
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const requestBody = await req.json();
    const { query, filters, facetFilters, workspaceId } = requestBody;

    if (!workspaceId) {
      return jsonResponse(400, { error: 'Missing required parameter: workspaceId' });
    }

    // Vérifier qu'on a soit une query, soit des filtres
    const hasQuery = query && query.trim();
    const hasFilters = (filters && Object.keys(filters).length > 0) 
      || (facetFilters && facetFilters.length > 0);

    if (!hasQuery && !hasFilters) {
      return jsonResponse(400, { 
        error: 'Missing required parameters: query or filters are required' 
      });
    }

    console.log('✅ Starting benchmark generation for workspace:', workspaceId);

    // 🔒 Vérifier que l'utilisateur appartient au workspace
    const { data: userWorkspace, error: userWorkspaceError } = await supabaseAdmin
      .from('users')
      .select('workspace_id')
      .eq('user_id', userId)
      .single();

    if (userWorkspaceError || !userWorkspace) {
      console.error('❌ Failed to fetch user workspace:', userWorkspaceError);
      return jsonResponse(403, { error: 'Access denied: user not found' });
    }

    if (userWorkspace.workspace_id !== workspaceId) {
      console.error('❌ Workspace mismatch:', { 
        userWorkspace: userWorkspace.workspace_id, 
        requestedWorkspace: workspaceId 
      });
      return jsonResponse(403, { 
        error: 'Access denied: you do not have access to this workspace' 
      });
    }

    console.log('✅ User authorized for workspace:', workspaceId);

    // Vérifier le plan et les quotas
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('plan_type')
      .eq('id', workspaceId)
      .single();

    if (!workspace) {
      return jsonResponse(404, { error: 'Workspace not found' });
    }

    console.log('✅ Workspace plan:', workspace.plan_type);

    // Vérifier les quotas pour Freemium
    if (workspace.plan_type === 'freemium') {
      const { data: trial } = await supabaseAdmin
        .from('workspace_trials')
        .select('expires_at')
        .eq('workspace_id', workspaceId)
        .single();

      const isInTrial = trial && new Date(trial.expires_at) > new Date();
      
      if (!isInTrial) {
        return jsonResponse(403, { 
          error: 'Feature reserved for Pro users',
          code: 'UPGRADE_REQUIRED'
        });
      }

      const { data: quotaData } = await supabaseAdmin
        .from('search_quotas')
        .select('benchmarks_used, benchmarks_limit')
        .eq('workspace_id', workspaceId)
        .single();

      if (quotaData && quotaData.benchmarks_used >= quotaData.benchmarks_limit) {
        return jsonResponse(403, {
          error: 'Benchmark quota exceeded',
          code: 'QUOTA_EXCEEDED',
          used: quotaData.benchmarks_used,
          limit: quotaData.benchmarks_limit,
        });
      }
    }

    // Récupérer les sources assignées
    const { data: assignedSourcesData } = await supabaseAdmin
      .from('fe_source_workspace_assignments')
      .select('source_name')
      .eq('workspace_id', workspaceId);
    
    const assignedSources = assignedSourcesData?.map(s => s.source_name) || [];
    console.log('✅ Assigned sources:', assignedSources.length);

    // Étape 1 : Validation (requête facets-only)
    const validationParams: any = {
      query: query || '', // Algolia accepte query vide
      hitsPerPage: 0,
      facets: ['Unite_fr', 'Périmètre_fr', 'Source', 'Date'],
    };

    // Construire facetFilters
    let allFacetFilters: any[] = [];
    if (filters) {
      const filterFacets = Object.entries(filters).map(([key, values]) => 
        (values as string[]).map(v => `${key}:${v}`)
      );
      allFacetFilters = [...filterFacets];
    }
    if (facetFilters) {
      allFacetFilters = allFacetFilters.length > 0 
        ? [...allFacetFilters, ...facetFilters]
        : facetFilters;
    }

    if (allFacetFilters.length > 0) {
      validationParams.facetFilters = allFacetFilters;
    }

    console.log('🔍 Validation query:', JSON.stringify(validationParams));
    const validationResult = await algoliaSearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY, ALGOLIA_INDEX_ALL, validationParams);
    console.log('✅ Validation result:', validationResult.nbHits, 'hits');

    // Vérifier unicité unité et périmètre
    const units = Object.keys(validationResult.facets?.Unite_fr || {});
    const scopes = Object.keys(validationResult.facets?.Périmètre_fr || {});

    if (units.length > 1) {
      return jsonResponse(400, { 
        error: 'Multiple units detected', 
        code: 'MULTIPLE_UNITS',
        units 
      });
    }

    if (scopes.length > 1) {
      return jsonResponse(400, { 
        error: 'Multiple scopes detected',
        code: 'MULTIPLE_SCOPES',
        scopes 
      });
    }

    if (units.length === 0 || scopes.length === 0) {
      return jsonResponse(400, { 
        error: 'No valid unit or scope found',
        code: 'NO_UNIT_OR_SCOPE'
      });
    }

    console.log('✅ Validation OK - Unit:', units[0], 'Scope:', scopes[0]);

    // Étape 2 : Requête complète
    // Note: Augmenter hitsPerPage car on filtre côté serveur (teasers, sources payantes non-assignées)
    const searchParams: any = {
      query: query || '', // Algolia accepte query vide
      hitsPerPage: 1000, // Max Algolia
      attributesToRetrieve: [
        'FE', 
        'Name',
        'Nom_fr',
        'Unite_fr', 
        'Périmètre_fr', 
        'Source', 
        'Date',
        'Localisation_fr',
        'Secteur_fr',
        'Sous-secteur_fr',
        'Description_fr',
        'Commentaires_fr',
        'Méthodologie',
        'Type_de_données',
        'Contributeur',
        'access_level', 
        'id',
        'objectID',
        'variant', 
        'is_blurred'
      ],
    };

    // Ajouter les facetFilters de l'utilisateur
    if (allFacetFilters.length > 0) {
      searchParams.facetFilters = allFacetFilters;
    }

    // Utiliser filters pour exclure teasers et blurred (syntaxe Algolia standard)
    searchParams.filters = 'NOT variant:teaser AND NOT is_blurred:true';

    console.log('🔍 Full search query');
    console.log('  - facetFilters:', JSON.stringify(searchParams.facetFilters));
    console.log('  - filters:', searchParams.filters);
    
    const searchResult = await algoliaSearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY, ALGOLIA_INDEX_ALL, searchParams);
    console.log('✅ Full search result:', searchResult.nbHits, 'hits,', searchResult.hits.length, 'returned');

    // Filtrer les résultats pour exclure sources payantes non-assignées
    const validHits = searchResult.hits.filter((hit: any) => {
      // Validation FE
      if (typeof hit.FE !== 'number' || isNaN(hit.FE)) return false;
      
      // Si c'est une source payante, vérifier qu'elle est assignée
      if (hit.access_level === 'paid' && !assignedSources.includes(hit.Source)) {
        return false;
      }
      
      return true;
    });

    console.log('✅ Valid hits after filtering:', validHits.length);

    if (validHits.length < 5) {
      return jsonResponse(400, { 
        error: 'Insufficient valid emission factors',
        code: 'INSUFFICIENT_DATA',
        count: validHits.length
      });
    }

    // Calculs statistiques
    const feValues = validHits.map((h: any) => h.FE);
    const statistics = calculateStatistics(feValues);
    
    if (!statistics) {
      return jsonResponse(500, { error: 'Failed to calculate statistics' });
    }

    console.log('✅ Statistics calculated');

    // Transformer les données pour le frontend
    const transformHit = (hit: any) => ({
      objectID: hit.objectID || hit.id || '',
      Nom_fr: hit.Nom_fr || hit.Name || '',
      FE: hit.FE,
      Unite_fr: hit.Unite_fr,
      Périmètre_fr: hit.Périmètre_fr,
      Source: hit.Source,
      Date: hit.Date || null,
      Localisation_fr: hit.Localisation_fr || null,
      Secteur_fr: hit.Secteur_fr || null,
      'Sous-secteur_fr': hit['Sous-secteur_fr'] || null,
      Description_fr: hit.Description_fr || null,
      Commentaires_fr: hit.Commentaires_fr || null,
      Méthodologie: hit.Méthodologie || null,
      Type_de_données: hit.Type_de_données || null,
      Contributeur: hit.Contributeur || null,
    });

    // Transformer pour chartData (avec propriétés en minuscules)
    const transformChartData = (hit: any) => ({
      objectID: hit.objectID || hit.id || '',
      name: hit.Nom_fr || hit.Name || '',
      fe: hit.FE,
      unit: hit.Unite_fr,
      scope: hit.Périmètre_fr,
      source: hit.Source,
      date: hit.Date || null,
      localisation: hit.Localisation_fr || '',
      sector: hit.Secteur_fr || '',
      description: hit.Description_fr || '',
      comments: hit.Commentaires_fr || '',
    });

    // Transformer TOUS les points pour le graphique (le frontend fera la sélection)
    const sorted = [...validHits].sort((a: any, b: any) => a.FE - b.FE);
    const chartData = sorted.map(transformChartData);
    
    // Top 10 et Worst 10
    const top10 = sorted.slice(0, 10).map(transformHit);
    const worst10 = sorted.slice(-10).reverse().map(transformHit);

    // Metadata
    const sources = [...new Set(validHits.map((h: any) => h.Source))];
    
    // Extraire les dates actives depuis les facetFilters (valeurs filtrées par l'utilisateur)
    const activeDates: number[] = [];
    if (allFacetFilters && Array.isArray(allFacetFilters)) {
      allFacetFilters.forEach((filterGroup: any) => {
        if (Array.isArray(filterGroup)) {
          filterGroup.forEach((filter: string) => {
            if (filter.startsWith('Date:')) {
              const dateValue = parseInt(filter.replace('Date:', ''), 10);
              if (!isNaN(dateValue)) {
                activeDates.push(dateValue);
              }
            }
          });
        } else if (typeof filterGroup === 'string' && filterGroup.startsWith('Date:')) {
          const dateValue = parseInt(filterGroup.replace('Date:', ''), 10);
          if (!isNaN(dateValue)) {
            activeDates.push(dateValue);
          }
        }
      });
    }
    
    // Dédupliquer et trier les dates
    const years = [...new Set(activeDates)].sort((a, b) => a - b);
    
    const hasMultipleSources = sources.length > 1;
    const hasMultipleYears = years.length > 1;
    const hasLargeSample = validHits.length > 500;

    const warnings: string[] = [];
    if (hasMultipleSources) {
      warnings.push(`Sources multiples détectées (${sources.length}) : les FE peuvent avoir des méthodologies différentes`);
    }
    if (hasLargeSample) {
      warnings.push(`Échantillon important (${validHits.length} FE) : l'analyse peut inclure des valeurs très hétérogènes`);
    }

    // Incrémenter le quota pour Freemium
    if (workspace.plan_type === 'freemium') {
      await supabaseAdmin
        .from('search_quotas')
        .update({ 
          benchmarks_used: supabaseAdmin.sql`benchmarks_used + 1` 
        })
        .eq('workspace_id', workspaceId);
      
      console.log('✅ Quota incremented');
    }

    console.log('✅ Benchmark generation complete');

    // Retourner les résultats
    return jsonResponse(200, {
      statistics,
      chartData,
      top10,
      worst10,
      metadata: {
        query: query || 'Filtres uniquement',
        unit: units[0],
        scope: scopes[0],
        sourcesCount: sources.length,
        sources,
        hasMultipleSources,
        hasMultipleYears,
        hasLargeSample,
        dateRange: years.length > 0 ? {
          min: Math.min(...years.map(Number)),
          max: Math.max(...years.map(Number)),
        } : null,
      },
      warnings,
    });

  } catch (error) {
    console.error('❌ Error generating benchmark:', error);
    return jsonResponse(500, { 
      error: error.message || 'Internal server error',
    });
  }
});
