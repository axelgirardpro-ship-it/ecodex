// CHUNKED UPLOAD: création d'un job d'import, délégation du chunking au job DB
// @ts-ignore - Import ESM valide pour Deno/Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Types pour l'environnement Deno/Edge Functions
interface DenoEnv { get(key: string): string | undefined }
interface DenoGlobal { env: DenoEnv; serve(h: (req: Request) => Promise<Response> | Response): void }
declare const Deno: DenoGlobal

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helpers JWT: décodage local pour éviter un aller-retour réseau
const base64UrlDecode = (str: string) => {
  try {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const decoded = atob(padded)
    const bytes = new Uint8Array([...decoded].map(c => c.charCodeAt(0)))
    const decoder = new TextDecoder('utf-8', { fatal: false })
    return decoder.decode(bytes)
  } catch {
    return ''
  }
}
const decodeJwt = (token: string): any | null => {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payloadJson = base64UrlDecode(parts[1])
    return JSON.parse(payloadJson)
  } catch {
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const jwt = decodeJwt(authHeader)
    const userId: string | null = jwt?.sub || null
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    const file_path: string = body?.file_path
    const filename: string = body?.filename || (file_path ? file_path.split('/').pop() : '')
    const file_size: number | null = body?.file_size ?? null
    const replace_all: boolean = Boolean(body?.replace_all ?? true)
    const language: string = String(body?.language || 'fr')
    const dataset_name: string | null = body?.dataset_name || null

    if (!file_path) {
      return new Response(JSON.stringify({ error: 'file_path is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Déterminer workspace_id utilisateur (pour jobs user)
    let workspace_id: string | null = null
    try {
      const { data: roles } = await supabase
        .from('user_roles')
        .select('workspace_id, role')
        .eq('user_id', userId)
      if (roles && roles.length > 0) {
        const priority: Record<string, number> = { supra_admin: 0, admin: 1, gestionnaire: 2, lecteur: 3 }
        const sorted = roles.slice().sort((a: any, b: any) => (priority[a.role] ?? 99) - (priority[b.role] ?? 99))
        workspace_id = sorted[0]?.workspace_id || null
      }
    } catch {}

    const isUserJob = Boolean(dataset_name)

    const { data: job, error: jobErr } = await supabase
      .from('import_jobs')
      .insert({
        user_id: userId,
        filename,
        file_path,
        original_size: file_size,
        total_chunks: 0,
        processed_chunks: 0,
        replace_all,
        language,
        status: 'pending',
        job_kind: isUserJob ? 'user' : 'admin',
        workspace_id: isUserJob ? workspace_id : null,
        dataset_name: isUserJob ? dataset_name : null
      })
      .select()
      .single()

    if (jobErr) throw jobErr

    // Pour les jobs utilisateur, assurer l'assignation de la source
    if (isUserJob && job?.id) {
      try { await supabase.rpc('ensure_user_source_assignment', { p_job_id: job.id }) } catch (e) { console.error('ensure_user_source_assignment error', e) }
    }

    // Optionnel: tenter d'enclencher immédiatement l'orchestration côté DB
    try { await supabase.rpc('enqueue_chunk_creation') } catch (e) { console.error('enqueue_chunk_creation error', e) }

    return new Response(JSON.stringify({
      success: true,
      job_id: job.id,
      status: job.status
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    console.error('chunked-upload fatal', error)
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
