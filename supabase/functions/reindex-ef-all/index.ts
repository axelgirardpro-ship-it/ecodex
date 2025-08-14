// @ts-nocheck
/* eslint-disable */
// Reindex complet vers Algolia ef_all (V1):
// 1) Rebuild projection emission_factors_all_search
// 2) ReplaceAllObjects en batch vers l'index ef_all

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Utilisation de l'API REST Algolia pour compatibilité Deno (évite les soucis d'imports ESM)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type Row = Record<string, any>

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const ALGOLIA_APP_ID = Deno.env.get('ALGOLIA_APP_ID') ?? ''
    const ALGOLIA_ADMIN_KEY = Deno.env.get('ALGOLIA_ADMIN_KEY') ?? ''
    const ALGOLIA_INDEX_ALL = Deno.env.get('ALGOLIA_INDEX_ALL') ?? 'ef_all'
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: 'Supabase environment not configured' })
    if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) return json(500, { error: 'Algolia environment not configured' })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const baseUrl = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX_ALL}`
    const headers = {
      'X-Algolia-Application-Id': ALGOLIA_APP_ID,
      'X-Algolia-API-Key': ALGOLIA_ADMIN_KEY,
      'Content-Type': 'application/json'
    }
    async function waitTask(taskID: number) {
      for (let i = 0; i < 60; i++) {
        const r = await fetch(`${baseUrl}/task/${taskID}`, { headers })
        const j: any = await r.json()
        if (j.status === 'published') return
        await new Promise((res) => setTimeout(res, 1000))
      }
      throw new Error(`waitTask timeout for ${taskID}`)
    }

    // Auth minimale: JWT utilisateur/supra, secret interne, ou token service_role
    const INTERNAL_CRON_SECRET = Deno.env.get('INTERNAL_CRON_SECRET') ?? ''
    const internalHeader = req.headers.get('X-Internal-Secret') || ''
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    const allowByInternal = Boolean(INTERNAL_CRON_SECRET && internalHeader && INTERNAL_CRON_SECRET === internalHeader)
    const allowByServiceRole = Boolean(authHeader && authHeader === SUPABASE_SERVICE_ROLE_KEY)
    if (!allowByInternal && !allowByServiceRole && !authHeader) return json(401, { error: 'Missing bearer token' })

    const body = await req.json().catch(()=>({})) as any
    const applySettings = body?.applySettings !== false
    const mode: 'rebuild' | 'refresh' = body?.mode === 'rebuild' ? 'rebuild' : 'refresh'

    // 1) Rebuild complet ou refresh par source pour éviter les timeouts
    if (mode === 'rebuild') {
      const { error: rebuildErr } = await supabase.rpc('rebuild_emission_factors_all_search')
      if (rebuildErr) return json(500, { step: 'rebuild', error: rebuildErr.message })
    } else {
      // Refresh par source (boucle) pour limiter la durée de chaque requête SQL
      const { data: sources, error: srcErr } = await supabase.from('fe_sources').select('source_name')
      if (srcErr) return json(500, { step: 'list_sources', error: srcErr.message })
      for (const s of (sources || [])) {
        const name = (s as any).source_name as string
        if (!name) continue
        const { error: rErr } = await supabase.rpc('refresh_projection_for_source_safe', { p_source: name })
        if (rErr) return json(500, { step: 'refresh_source', source: name, error: rErr.message })
      }
    }

    // Quick count after rebuild (head count)
    const { error: headErr, count } = await supabase
      .from('emission_factors_all_search')
      .select('*', { count: 'exact', head: true })
    if (headErr) return json(500, { step: 'count_after_rebuild', error: headErr.message })

    // 2) stream projection and push directly (clear + saveObjects chunks)
    const pageSize = 5000
    let from = 0
    let total = 0
    let cleared = false
    try {
      const resp = await fetch(`${baseUrl}/clear`, { method: 'POST', headers })
      const j = await resp.json()
      if (!resp.ok) return json(500, { step: 'clear', error: j })
      await waitTask(j.taskID)
      cleared = true
    } catch (e) {
      // index peut être vide; continuer
    }

    while (true) {
      const { data: rows, error } = await supabase
        .from('emission_factors_all_search')
        .select('*')
        .range(from, from + pageSize - 1)
      if (error) return json(500, { step: 'fetch_projection', from, error: error.message })
      if (!rows || rows.length === 0) break

      const records = rows.map((r: Row) => ({ ...r, objectID: String(r.object_id) }))
      try {
        const batchBody = {
          requests: records.map((body) => ({ action: 'updateObject', body }))
        }
        const resp = await fetch(`${baseUrl}/batch`, { method: 'POST', headers, body: JSON.stringify(batchBody) })
        const j = await resp.json()
        if (!resp.ok) return json(500, { step: 'save_chunk', from, size: records.length, error: j })
        if (typeof j.taskID === 'number') await waitTask(j.taskID)
      } catch (e) {
        return json(500, { step: 'save_chunk_fetch', from, size: records.length, error: String(e) })
      }
      total += records.length
      from += pageSize
    }

    // 3) Optionnel: appliquer les settings/rules/synonyms depuis Storage
    let settingsApplied: any = null
    if (applySettings) {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/apply-algolia-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authHeader}` },
        body: JSON.stringify({ indexName: ALGOLIA_INDEX_ALL, bucket: 'algolia_settings', path: 'ef_all.json' })
      })
      settingsApplied = await resp.json().catch(()=>null)
      if (!resp.ok) return json(500, { step: 'apply_settings', error: settingsApplied })
    }

    return json(200, { ok: true, indexed: total, index: ALGOLIA_INDEX_ALL, cleared, settingsApplied })
  } catch (e) {
    return json(500, { step: 'top_catch', error: String(e) })
  }
})


