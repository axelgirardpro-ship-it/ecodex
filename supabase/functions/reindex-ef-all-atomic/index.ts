// @ts-nocheck
/* eslint-disable */
// Reindex atomique: ef_all_tmp <- données + settings, puis moveIndex vers ef_all

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function waitTask(baseUrl: string, headers: any, taskID: number) {
  for (let i = 0; i < 120; i++) {
    const r = await fetch(`${baseUrl}/task/${taskID}`, { headers })
    const j: any = await r.json()
    if (j.status === 'published') return
    await new Promise((res) => setTimeout(res, 1000))
  }
  throw new Error(`waitTask timeout for ${taskID}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const ALGOLIA_APP_ID = Deno.env.get('ALGOLIA_APP_ID') ?? ''
    const ALGOLIA_ADMIN_KEY = Deno.env.get('ALGOLIA_ADMIN_KEY') ?? ''
    const ALGOLIA_INDEX_ALL = Deno.env.get('ALGOLIA_INDEX_ALL') ?? 'ef_all'
    const TMP = `${ALGOLIA_INDEX_ALL}_tmp`

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) {
      return json(500, { error: 'Missing environment configuration' })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // AuthN/AuthZ: exiger un JWT utilisateur supra admin
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    if (!authHeader) return json(401, { error: 'Missing bearer token' })
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader)
    if (authErr || !user) return json(401, { error: 'Invalid token' })
    const { data: isAdmin, error: roleErr } = await supabase.rpc('is_supra_admin', { user_uuid: user.id })
    if (roleErr || !isAdmin) return json(403, { error: 'Access denied - supra admin required' })
    const baseUrl = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes`
    const headers = {
      'X-Algolia-Application-Id': ALGOLIA_APP_ID,
      'X-Algolia-API-Key': ALGOLIA_ADMIN_KEY,
      'Content-Type': 'application/json'
    }

    // Copier les settings/rules/synonyms
    // Option via function existante
    await fetch(`${SUPABASE_URL}/functions/v1/apply-algolia-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: req.headers.get('Authorization') || '' },
      body: JSON.stringify({ indexName: TMP, bucket: 'algolia_settings', path: `${ALGOLIA_INDEX_ALL}.json` })
    })

    // Stream de la projection et push vers TMP
    const pageSize = 5000
    let from = 0
    let total = 0
    while (true) {
      const { data: rows, error } = await supabase
        .from('emission_factors_all_search')
        .select('*')
        .range(from, from + pageSize - 1)
      if (error) return json(500, { step: 'fetch_projection', from, error: error.message })
      if (!rows || rows.length === 0) break

      const requests = rows.map((r: any) => ({ action: 'updateObject', body: { ...r, objectID: String(r.object_id) } }))
      for (let i = 0; i < requests.length; i += 1000) {
        const chunk = requests.slice(i, i + 1000)
        const resp = await fetch(`${baseUrl}/${TMP}/batch`, { method: 'POST', headers, body: JSON.stringify({ requests: chunk }) })
        const j = await resp.json()
        if (!resp.ok) return json(500, { step: 'save_chunk', from, error: j })
        if (typeof j.taskID === 'number') await waitTask(`${baseUrl}/${TMP}`, headers, j.taskID)
      }
      total += rows.length
      from += pageSize
    }

    // Move index (atomique)
    const moveResp = await fetch(`${baseUrl}/${TMP}/operation`, {
      method: 'POST', headers, body: JSON.stringify({ operation: 'move', destination: ALGOLIA_INDEX_ALL })
    })
    const moveJ = await moveResp.json()
    if (!moveResp.ok) return json(500, { step: 'move', error: moveJ })
    if (typeof moveJ.taskID === 'number') await waitTask(`${baseUrl}/${ALGOLIA_INDEX_ALL}`, headers, moveJ.taskID)

    return json(200, { ok: true, indexed: total, index: ALGOLIA_INDEX_ALL })
  } catch (e) {
    return json(500, { error: String(e) })
  }
})


