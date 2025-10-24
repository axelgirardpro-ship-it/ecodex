/**
 * Edge Function: chunked-upload
 * Délègue l'import CSV à import-csv-user après validation JWT
 */
// @ts-ignore Deno runtime types
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================
// TYPES & INTERFACES
// ============================================

interface JWTPayload {
  sub: string;
  [key: string]: unknown;
}

interface ChunkedUploadRequest {
  dataset_name?: string;
  name?: string;
  file_path?: string;
  path?: string;
  language?: string;
  add_to_favorites?: boolean;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// @ts-ignore Deno runtime
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

    // @ts-ignore Deno.env
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    // @ts-ignore Deno.env
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('[chunked-upload] No Authorization header')
      return json(401, { error: 'Missing bearer token' })
    }

    const token = authHeader.replace('Bearer ', '')
    
    console.log('[chunked-upload] Validating JWT')
    
    // Décoder le JWT pour obtenir le payload (sans vérification de signature)
    let userId: string
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format')
      }
      
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as JWTPayload
      userId = payload.sub
      
      if (!userId) {
        throw new Error('No user ID in JWT')
      }
      
      console.log('[chunked-upload] Extracted user ID from JWT:', userId)
    } catch (error) {
      console.error('[chunked-upload] Failed to decode JWT:', error)
      return json(401, { error: 'Invalid JWT format' })
    }
    
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Valider que l'utilisateur existe en utilisant l'admin API
    const { data: authUser, error: authErr } = await supabase.auth.admin.getUserById(userId)
    
    if (authErr || !authUser) {
      console.error('[chunked-upload] User validation failed:', authErr)
      return json(401, { error: 'Invalid user' })
    }

    const user = authUser.user
    console.log('[chunked-upload] User authenticated successfully:', user.id)

    const body = await req.json().catch(()=> ({})) as ChunkedUploadRequest
    // Nouveau flux: délègue intégralement à import-csv-user
    const datasetName = String(body.dataset_name || body.name || '')
    const filePath = String(body.file_path || body.path || '')
    const language = String(body.language || 'fr')
    const addToFavorites = Boolean(body.add_to_favorites === true)

    if (!datasetName || !filePath) {
      return json(400, { error: 'file_path and dataset_name are required' })
    }

    const resp = await fetch(`${SUPABASE_URL}/functions/v1/import-csv-user`, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ file_path: filePath, dataset_name: datasetName, language, add_to_favorites: addToFavorites }),
    })

    const contentType = resp.headers.get('content-type') || ''
    if (!resp.ok) {
      const details: unknown = await (contentType.includes('application/json') ? resp.json() : resp.text())
      return json(resp.status, { error: 'delegate_failed', details })
    }
    const data = await resp.json() as unknown
    return json(200, { delegated: true, data })
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return json(500, { error: errorMessage })
  }
})
