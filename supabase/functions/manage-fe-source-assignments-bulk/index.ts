// @ts-nocheck
/* eslint-disable */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!authHeader) return json(401, { error: 'Missing bearer token' })
    const { data: userRes, error: userErr } = await supabase.auth.getUser(authHeader)
    if (userErr || !userRes?.user) return json(401, { error: 'Unauthorized' })

    const body = await req.json()
    const workspaceId = body?.workspace_id as string
    const assigned = Array.isArray(body?.assigned) ? body.assigned as string[] : []
    const unassigned = Array.isArray(body?.unassigned) ? body.unassigned as string[] : []

    if (!workspaceId) return json(400, { error: 'workspace_id is required' })

    // MAJ assignations via RPC (couvre upserts/suppressions)
    const { error: rpcErr } = await supabase.rpc('bulk_manage_fe_source_assignments', {
      p_workspace_id: workspaceId,
      p_assigned_source_names: assigned,
      p_unassigned_source_names: unassigned
    })
    if (rpcErr) return json(500, { step: 'rpc', error: rpcErr.message })

    // Rafraîchir projection unifiée pour chaque source modifiée
    const changed = [...new Set([...assigned, ...unassigned])]
    const refreshStatuses: Record<string, string> = {}
    for (const src of changed) {
      const { error } = await supabase.rpc('refresh_ef_all_for_source', { p_source: src })
      refreshStatuses[src] = error ? `error: ${error.message}` : 'ok'
    }

    return json(200, { ok: true, refresh: refreshStatuses })
  } catch (e) {
    return json(500, { error: String(e) })
  }
})


