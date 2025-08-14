// @ts-nocheck
/* eslint-disable */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import algoliasearch from 'npm:algoliasearch'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

async function loadSettingsFromStorage(supabase: ReturnType<typeof createClient>, key: string) {
  // Try bucket algolia_settings, fallback to source-logos (existing bucket) if not found
  let download = await supabase.storage.from('algolia_settings').download(key)
  if (download.error) {
    // Fallback
    download = await supabase.storage.from('source-logos').download(key)
    if (download.error) {
      throw new Error(`Settings download failed for ${key}: ${download.error.message}`)
    }
  }
  const text = await download.data.text()
  const parsed = JSON.parse(text)
  return { settings: parsed.settings || {}, rules: parsed.rules || [], synonyms: parsed.synonyms || [] }
}

async function fetchAllRows<T = any>(supabase: ReturnType<typeof createClient>, table: string, pageSize = 10000): Promise<T[]> {
  let from = 0
  const out: T[] = []
  for (;;) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + pageSize - 1)
    if (error) throw new Error(`Select from ${table} failed: ${error.message}`)
    if (!data || data.length === 0) break
    // @ts-ignore
    out.push(...data)
    if (data.length < pageSize) break
    from += data.length
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const ALGOLIA_APP_ID = Deno.env.get('ALGOLIA_APP_ID') ?? ''
    const ALGOLIA_ADMIN_API_KEY = Deno.env.get('ALGOLIA_ADMIN_API_KEY') || Deno.env.get('ALGOLIA_ADMIN_KEY') || ''

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: 'Supabase environment not configured' })
    if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_API_KEY) return json(500, { error: 'Algolia environment not configured' })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Auth: JWT utilisateur (supra_admin), secret interne, ou token service_role
    const INTERNAL_CRON_SECRET = Deno.env.get('INTERNAL_CRON_SECRET') ?? ''
    const internalHeader = req.headers.get('X-Internal-Secret') || ''
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '') || ''
    const allowByInternalSecret = Boolean(INTERNAL_CRON_SECRET && internalHeader && INTERNAL_CRON_SECRET === internalHeader)
    const allowByServiceRole = Boolean(authHeader && authHeader === SUPABASE_SERVICE_ROLE_KEY)

    if (!allowByInternalSecret && !allowByServiceRole) {
      if (!authHeader) return json(401, { error: 'Missing bearer token' })
      const { data: userRes, error: userErr } = await supabase.auth.getUser(authHeader)
      if (userErr || !userRes?.user) return json(401, { error: 'Unauthorized' })
      const { data: isSupra, error: roleErr } = await supabase.rpc('is_supra_admin', { user_uuid: userRes.user.id })
      if (roleErr || !isSupra) return json(403, { error: 'Access denied - supra admin required' })
    }

    const body = await req.json()
    const indexParam = (body?.index as string) || 'all' // 'public' | 'private' | 'all'
    const applySettings = body?.applySettings !== false

    const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_API_KEY)

    async function reindexOne(kind: 'public' | 'private') {
      const table = kind === 'public' ? 'emission_factors_public_search_fr' : 'emission_factors_private_search_fr'
      const indexName = kind === 'public' ? 'ef_public_fr' : 'ef_private_fr'
      const settingsKey = kind === 'public' ? 'ef_public_fr.json' : 'ef_private_fr.json'

      // Charger les settings depuis Storage
      const loaded = applySettings ? await loadSettingsFromStorage(supabase, settingsKey) : { settings: {}, rules: [], synonyms: [] }
      const settings = loaded.settings || {}
      const rules = loaded.rules || []
      const synonyms = loaded.synonyms || []

      // S'assurer que les filtres critiques sont facetables (sinon les filtres côté client sont ignorés)
      const requiredFacetAttrs = [
        'Source',
        'access_level',
        'is_blurred',
        'variant',
        'workspace_id',
        'import_type'
      ]
      const existing: string[] = Array.isArray(settings.attributesForFaceting) ? settings.attributesForFaceting : []
      const exists = (name: string) => existing.some((e) => e === name || e === `filterOnly(${name})` || e === `searchable(${name})`)
      const additions = requiredFacetAttrs.filter((a) => !exists(a)).map((a)=>`filterOnly(${a})`)
      if (additions.length) {
        settings.attributesForFaceting = [...existing, ...additions]
      }

      // Charger toutes les lignes
      const rows = await fetchAllRows<any>(supabase, table)
      const objects = rows.map((r) => ({ objectID: r.object_id, ...r }))

      const index = client.initIndex(indexName)
      // swap atomique sans downtime (cf. doc replaceAllObjects)
      await index.replaceAllObjects(objects, { safe: true })

      if (applySettings) {
        await index.setSettings(settings)
        if (rules && rules.length) await index.saveRules(rules, { clearExistingRules: true, forwardToReplicas: true })
        if (synonyms && synonyms.length) await index.saveSynonyms(synonyms, { replaceExistingSynonyms: true, forwardToReplicas: true })
      }

      return { index: indexName, pushed: objects.length }
    }

    const results: any[] = []
    if (indexParam === 'public' || indexParam === 'all') results.push(await reindexOne('public'))
    if (indexParam === 'private' || indexParam === 'all') results.push(await reindexOne('private'))

    return json(200, { ok: true, results })
  } catch (e) {
    return json(500, { error: String(e) })
  }
})


