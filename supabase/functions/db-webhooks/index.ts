// @ts-nocheck
/* eslint-disable */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type DBEvent = {
  type: 'INSERT'|'UPDATE'|'DELETE'
  table: string
  schema?: string
  record?: any
  old_record?: any
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret, X-Webhook-Secret, x-supabase-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function getTableName(raw: string | undefined | null): string {
  if (!raw) return ''
  // Supabase DB Webhooks peuvent fournir "public:table" ou simplement "table"
  const s = String(raw)
  const p = s.includes(':') ? s.split(':').pop() : s
  return (p || '').trim()
}

function pickSource(rec: any): string | null {
  if (!rec) return null
  // Gérer la casse potentielle selon le payload du webhook
  return rec['Source'] ?? rec['source'] ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const WEBHOOK_SECRET = Deno.env.get('DB_WEBHOOK_SECRET') ?? ''
    const ALGOLIA_APP_ID = Deno.env.get('ALGOLIA_APP_ID') ?? ''
    const ALGOLIA_ADMIN_KEY = Deno.env.get('ALGOLIA_ADMIN_KEY') ?? ''
    const ALGOLIA_INDEX_ALL = Deno.env.get('ALGOLIA_INDEX_ALL') ?? 'ef_all'

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: 'Supabase environment not configured' })

    // Sécurisation simple par secret partagé (ou signature Supabase si configurée)
    if (WEBHOOK_SECRET) {
      const provided = req.headers.get('x-webhook-secret') || req.headers.get('X-Webhook-Secret') || req.headers.get('x-supabase-signature')
      if (!provided || provided !== WEBHOOK_SECRET) return json(401, { error: 'Unauthorized' })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const body = await req.json().catch(()=> ({}))
    const events: DBEvent[] = Array.isArray(body) ? body : [body]

    const sourcesToSync = new Set<string>()

    for (const e of events) {
      const table = getTableName(e?.table)
      const rec = e?.record || e?.old_record || {}
      if (!table) continue

      if (table === 'emission_factors') {
        const src = pickSource(rec)
        if (src) sourcesToSync.add(String(src))
      }
      if (table === 'fe_source_workspace_assignments') {
        const src = rec?.source_name
        if (src) sourcesToSync.add(String(src))
      }
      if (table === 'fe_sources') {
        const src = rec?.source_name
        if (src) sourcesToSync.add(String(src))
      }
      if (table === 'favorites') {
        // Maintenir favorites_used côté serveur
        const userId = rec?.user_id
        const delta = e?.type === 'INSERT' ? 1 : (e?.type === 'DELETE' ? -1 : 0)
        if (userId && delta !== 0) {
          try { await supabase.rpc('adjust_favorites_quota', { p_user: userId, p_delta: delta }) } catch (_) {}
        }
      }
    }

    async function syncAlgoliaForSource(sourceName: string): Promise<'ok'|'skipped'|'failed'> {
      if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) return 'skipped'
      try {
        const { default: algoliasearch } = await import('https://esm.sh/algoliasearch@5?target=deno')
        const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_ADMIN_KEY)
        const index = client.initIndex(ALGOLIA_INDEX_ALL)

        // Projection à jour
        await supabase.rpc('refresh_ef_all_for_source', { p_source: sourceName })

        const { data: rows, error } = await supabase
          .from('emission_factors_all_search')
          .select('*')
          .eq('Source', sourceName)
        if (error) throw new Error(`projection fetch failed: ${error.message}`)

        const records = (rows || []).map((r: any) => ({ ...r, objectID: String(r.object_id) }))
        const currentIds = new Set(records.map((r: any) => r.objectID))

        const existingIds: string[] = []
        await index.browseObjects({
          query: '',
          filters: `Source:\"${sourceName.replaceAll('"', '\\"')}\"`,
          attributesToRetrieve: ['objectID'],
          batch: (batch: any[]) => { for (const h of batch) existingIds.push(String(h.objectID)) }
        })
        const toDelete = existingIds.filter((id) => !currentIds.has(id))
        if (toDelete.length > 0) await index.deleteObjects(toDelete)
        if (records.length > 0) await index.saveObjects(records, { autoGenerateObjectIDIfNotExist: false })
        return 'ok'
      } catch (_) {
        return 'failed'
      }
    }

    const results: Record<string,string> = {}
    for (const s of Array.from(sourcesToSync)) {
      results[s] = await syncAlgoliaForSource(s)
    }

    return json(200, { ok: true, synced: results, sources: Array.from(sourcesToSync) })
  } catch (e) {
    return json(500, { error: String(e) })
  }
})


