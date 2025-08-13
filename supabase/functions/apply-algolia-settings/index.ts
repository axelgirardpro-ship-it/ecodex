import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function waitTask(baseUrl: string, headers: Record<string, string>, taskID: number) {
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
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const ALGOLIA_APP_ID = Deno.env.get('ALGOLIA_APP_ID') ?? ''
    const ALGOLIA_ADMIN_KEY = Deno.env.get('ALGOLIA_ADMIN_KEY') ?? ''
    const DEFAULT_INDEX = Deno.env.get('ALGOLIA_INDEX_ALL') ?? 'ef_all'
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: 'Supabase environment not configured' })
    if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) return json(500, { error: 'Algolia environment not configured' })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Auth minimal: exiger un bearer; on peut renforcer si besoin
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!authHeader) return json(401, { error: 'Missing bearer token' })

    const body = await req.json().catch(() => ({})) as any
    const indexName = body?.indexName || DEFAULT_INDEX
    const storageBucket = body?.bucket || 'algolia_settings'
    const storagePath = body?.path || 'ef_all.json'

    // Télécharger le fichier JSON depuis Storage
    const { data: file, error: dlErr } = await supabase.storage.from(storageBucket).download(storagePath)
    if (dlErr || !file) return json(500, { step: 'download_settings', error: dlErr?.message || 'download failed' })
    const text = await file.text()
    let parsed: any
    try { parsed = JSON.parse(text) } catch (e) { return json(400, { step: 'parse_settings', error: String(e) }) }

    // Supporte deux formats: { settings, synonyms, rules } ou un JSON de settings pur
    const settings = parsed.settings ?? parsed
    const synonyms = parsed.synonyms ?? []
    const rules = parsed.rules ?? []

    const baseUrl = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${indexName}`
    const headers = {
      'X-Algolia-Application-Id': ALGOLIA_APP_ID,
      'X-Algolia-API-Key': ALGOLIA_ADMIN_KEY,
      'Content-Type': 'application/json'
    }

    let applied: Record<string, number | boolean> = {}

    // 1) Settings
    if (settings && typeof settings === 'object') {
      const resp = await fetch(`${baseUrl}/settings`, { method: 'PUT', headers, body: JSON.stringify(settings) })
      const j = await resp.json()
      if (!resp.ok) return json(500, { step: 'apply_settings', error: j })
      if (typeof j.taskID === 'number') await waitTask(baseUrl, headers, j.taskID)
      applied.settings = 1
    }

    // 2) Synonyms (si fournis)
    if (Array.isArray(synonyms) && synonyms.length > 0) {
      const resp = await fetch(`${baseUrl}/synonyms/batch?replaceExistingSynonyms=true`, { method: 'POST', headers, body: JSON.stringify(synonyms) })
      const j = await resp.json()
      if (!resp.ok) return json(500, { step: 'apply_synonyms', error: j })
      if (typeof j.taskID === 'number') await waitTask(baseUrl, headers, j.taskID)
      applied.synonyms = synonyms.length
    }

    // 3) Rules (si fournies)
    if (Array.isArray(rules) && rules.length > 0) {
      const resp = await fetch(`${baseUrl}/rules/batch?clearExistingRules=true`, { method: 'POST', headers, body: JSON.stringify(rules) })
      const j = await resp.json()
      if (!resp.ok) return json(500, { step: 'apply_rules', error: j })
      if (typeof j.taskID === 'number') await waitTask(baseUrl, headers, j.taskID)
      applied.rules = rules.length
    }

    return json(200, { ok: true, index: indexName, applied })
  } catch (e) {
    return json(500, { step: 'top_catch', error: String(e) })
  }
})


