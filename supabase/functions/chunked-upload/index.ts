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

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader)
    if (authError || !user) {
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
        .eq('user_id', user.id)
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
        user_id: user.id,
        filename,
        file_path,
        original_size: file_size,
        total_chunks: null,
        processed_chunks: 0,
        replace_all,
        language,
        status: 'queued',
        job_kind: isUserJob ? 'user' : 'admin',
        workspace_id: isUserJob ? workspace_id : null,
        dataset_name: isUserJob ? dataset_name : null
      })
      .select()
      .single()

    if (jobErr) throw jobErr

    // Pour les jobs utilisateur, assurer l'assignation de la source
    if (isUserJob && job?.id) {
      try { await supabase.rpc('ensure_user_source_assignment', { p_job_id: job.id }) } catch {}
    }

    // Optionnel: tenter d'enclencher immédiatement l'orchestration côté DB
    try { await supabase.rpc('enqueue_chunk_creation') } catch {}

    return new Response(JSON.stringify({
      success: true,
      job_id: job.id,
      status: job.status
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
