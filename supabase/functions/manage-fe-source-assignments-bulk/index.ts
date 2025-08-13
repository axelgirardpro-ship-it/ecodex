import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import algoliasearch from 'npm:algoliasearch'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

interface BulkPayload {
  workspace_id: string
  assigned?: string[]
  unassigned?: string[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: 'Supabase environment not configured' })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!authHeader) return json(401, { error: 'Missing bearer token' })
    const { data: userRes, error: userErr } = await supabase.auth.getUser(authHeader)
    if (userErr || !userRes?.user) return json(401, { error: 'Unauthorized' })

    const { data: isSupra } = await supabase.rpc('is_supra_admin', { user_uuid: userRes.user.id })
    if (!isSupra) return json(403, { error: 'Access denied - supra admin required' })

    const body = (await req.json()) as BulkPayload
    const workspace_id = body?.workspace_id
    const assigned = Array.isArray(body?.assigned) ? body.assigned.filter(Boolean) : []
    const unassigned = Array.isArray(body?.unassigned) ? body.unassigned.filter(Boolean) : []
    if (!workspace_id) return json(400, { error: 'Missing workspace_id' })

    // Upsert assigned
    if (assigned.length > 0) {
      const rows = assigned.map((source_name) => ({ source_name, workspace_id, assigned_by: userRes.user.id }))
      const { error } = await supabase
        .from('fe_source_workspace_assignments')
        .upsert(rows, { onConflict: 'source_name,workspace_id' })
      if (error) return json(500, { error: `Upsert failed: ${error.message}` })
    }

    // Delete unassigned
    if (unassigned.length > 0) {
      const { error } = await supabase
        .from('fe_source_workspace_assignments')
        .delete()
        .eq('workspace_id', workspace_id)
        .in('source_name', unassigned)
      if (error) return json(500, { error: `Delete failed: ${error.message}` })
    }

    // Rafraîchir la projection et synchroniser Algolia pour chaque source touchée
    const touched = Array.from(new Set([...assigned, ...unassigned]))

    async function syncAlgoliaForSource(sourceName: string) {
      const ALGOLIA_APP_ID = Deno.env.get('ALGOLIA_APP_ID') ?? ''
      const ALGOLIA_ADMIN_KEY = Deno.env.get('ALGOLIA_ADMIN_KEY') ?? ''
      const ALGOLIA_INDEX_PUBLIC = Deno.env.get('ALGOLIA_INDEX_PUBLIC') ?? 'ef_public_fr'
      if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) return

      const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY)
      const index = client.initIndex(ALGOLIA_INDEX_PUBLIC)

      const { data: rows, error } = await supabase
        .from('emission_factors_public_search_fr')
        .select('*')
        .eq('Source', sourceName)
      if (error) throw new Error(`Projection fetch failed: ${error.message}`)

      const records = (rows || []).map((r: any) => ({ ...r, objectID: String(r.object_id) }))
      const currentIds = new Set(records.map((r: any) => r.objectID))

      const existingIds: string[] = []
      await index.browseObjects({
        query: '',
        filters: `Source:"${sourceName.replace(/"/g, '\\"')}"`,
        attributesToRetrieve: ['objectID'],
        batch: (batch: any[]) => {
          for (const hit of batch) existingIds.push(String(hit.objectID))
        }
      })
      const toDelete = existingIds.filter((id) => !currentIds.has(id))
      if (toDelete.length > 0) await index.deleteObjects(toDelete)
      if (records.length > 0) await index.saveObjects(records, { autoGenerateObjectIDIfNotExist: false })
    }

    for (const source_name of touched) {
      await supabase.rpc('refresh_projection_for_source', { p_source: source_name })
      await syncAlgoliaForSource(source_name)
    }

    return json(200, { ok: true, workspace_id, assigned: assigned.length, unassigned: unassigned.length })
  } catch (e) {
    return json(500, { error: String(e) })
  }
})


