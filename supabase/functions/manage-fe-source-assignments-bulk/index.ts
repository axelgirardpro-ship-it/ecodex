// @ts-nocheck
/* eslint-disable */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, Authorization, x-client-info, X-Client-Info, apikey, content-type, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
  try {
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!authHeader) return json(401, { error: 'Missing bearer token' })
    const { data: userRes, error: userErr } = await supabase.auth.getUser(authHeader)
    if (userErr || !userRes?.user) return json(401, { error: 'Unauthorized', details: userErr?.message })

    // Vérifier supra admin, comme dans manage-fe-source-assignments
    const { data: isSupra, error: roleErr } = await supabase.rpc('is_supra_admin', { user_uuid: userRes.user.id })
    if (roleErr) {
      console.error('AUTHZ_ERROR', roleErr?.message)
      return json(500, { error: 'Authorization check failed', details: roleErr?.message })
    }
    if (!isSupra) return json(403, { error: 'Access denied - supra admin required' })

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

    // Fallback: si la RPC n'existe pas ou échoue, on applique directement via inserts/deletes
    if (rpcErr) {
      console.error('BULK_RPC_ERROR', rpcErr?.message)
      // Upsert assignés
      if (assigned.length > 0) {
        const rows = assigned.map((src) => ({ source_name: src, workspace_id: workspaceId, assigned_by: userRes.user.id }))
        const { error: upsertErr } = await supabase
          .from('fe_source_workspace_assignments')
          .upsert(rows, { onConflict: 'source_name,workspace_id' })
        if (upsertErr) return json(500, { step: 'fallback_upsert', error: upsertErr.message })
      }

      // Delete désassignés
      if (unassigned.length > 0) {
        const { error: delErr } = await supabase
          .from('fe_source_workspace_assignments')
          .delete()
          .eq('workspace_id', workspaceId)
          .in('source_name', unassigned)
        if (delErr) return json(500, { step: 'fallback_delete', error: delErr.message })
      }
    }

    // Rafraîchir projection unifiée pour chaque source modifiée
    const changedAll = [...new Set([...assigned, ...unassigned])]
    const refreshStatuses: Record<string, string> = {}

    // Ne rafraîchir que les sources premium pour éviter les temps d'exécution trop longs
    let toRefresh = changedAll
    if (changedAll.length > 0) {
      const { data: fsRows, error: fsErr } = await supabase
        .from('fe_sources')
        .select('source_name, access_level')
        .in('source_name', changedAll)
      if (fsErr) {
        console.error('FS_QUERY_ERROR', fsErr.message)
      } else if (fsRows && fsRows.length > 0) {
        toRefresh = fsRows
          .filter((r: any) => r.access_level === 'premium')
          .map((r: any) => r.source_name)
      }
    }

    for (const src of toRefresh) {
      const { error } = await supabase.rpc('refresh_ef_all_for_source', { p_source: src })
      refreshStatuses[src] = error ? `error: ${error.message}` : 'ok'
    }

    return json(200, { ok: true, refresh: refreshStatuses })
  } catch (e) {
    return json(500, { error: String(e) })
  }
})


