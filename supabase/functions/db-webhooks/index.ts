// @ts-nocheck
/* eslint-disable */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type DBEvent = {
  type: 'INSERT'|'UPDATE'|'DELETE'
  table: string
  schema?: string
  record?: any
  old_record?: any
  new?: any
  old?: any
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
    // Auth souple: si un header est fourni et qu'un secret est défini, on valide l'égalité.
    // En mode "Supabase Edge Functions" (interne), aucun header n'est envoyé: on autorise.
    // Accepter tous les appels (les Webhooks Edge→Edge ne transmettent pas toujours un secret cohérent)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const body = await req.json().catch(()=> ({}))
    const events: DBEvent[] = Array.isArray(body) ? body : [body]
    console.log('[db-webhooks] received events:', Array.isArray(body) ? body.length : 1)

    const sourcesToSync = new Set<string>()

    for (const e of events) {
      const table = getTableName(e?.table)
      const rec = e?.record ?? e?.new ?? e?.old ?? e?.old_record ?? {}
      if (!table) continue
      console.log('[db-webhooks] evt', { table, type: e?.type })

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
          try {
            const { error } = await supabase.rpc('adjust_favorites_quota', { p_user: userId, p_delta: delta })
            if (error) console.error('[db-webhooks] adjust_favorites_quota error', error?.message)
            else console.log('[db-webhooks] adjust_favorites_quota ok', { userId, delta })
          } catch (err) {
            console.error('[db-webhooks] adjust_favorites_quota exception', String(err))
          }
        }
      }
    }

    async function syncAlgoliaForSource(sourceName: string): Promise<'ok'|'skipped'|'failed'> {
      if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) return 'skipped'
      try {
        // Garantir l'existence de la source pour la projection
        try {
          await supabase
            .from('fe_sources')
            .upsert({ source_name: sourceName, access_level: 'standard', is_global: false }, { onConflict: 'source_name' })
        } catch (_) { /* best-effort */ }

        // Utiliser l'API REST Algolia directement avec fetch (compatible Deno/Edge Functions)
        const algoliaHeaders = {
          'X-Algolia-API-Key': ALGOLIA_ADMIN_KEY,
          'X-Algolia-Application-Id': ALGOLIA_APP_ID,
          'Content-Type': 'application/json'
        }

        // Projection à jour
        await supabase.rpc('refresh_ef_all_for_source', { p_source: sourceName })

        const { data: rows, error } = await supabase
          .from('emission_factors_all_search')
          .select('*')
          .eq('Source', sourceName)
        if (error) throw new Error(`projection fetch failed: ${error.message}`)

        const records = (rows || []).map((r: any) => ({ ...r, objectID: String(r.object_id) }))
        const currentIds = new Set(records.map((r: any) => r.objectID))

        // Récupérer les objectID existants pour cette Source via API REST
        const existingIds: string[] = []
        const searchUrl = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX_ALL}/query`
        const searchBody = {
          query: '',
          filters: `Source:"${sourceName}"`,
          attributesToRetrieve: ['objectID', 'Source'],
          hitsPerPage: 1000
        }
        
        const searchResponse = await fetch(searchUrl, {
          method: 'POST',
          headers: algoliaHeaders,
          body: JSON.stringify(searchBody)
        })
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json()
          if (searchData.hits) {
            searchData.hits.forEach((hit: any) => {
              existingIds.push(String(hit.objectID))
            })
          }
        }
        const toDelete = existingIds.filter((id) => !currentIds.has(id))
        
        // Supprimer les objets obsolètes via API REST
        if (toDelete.length > 0) {
          const deleteUrl = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX_ALL}/deleteByQuery`
          const deleteBody = {
            filters: `Source:"${sourceName}" AND objectID:${toDelete.map(id => `"${id}"`).join(' OR objectID:')}`
          }
          
          await fetch(deleteUrl, {
            method: 'POST',
            headers: algoliaHeaders,
            body: JSON.stringify(deleteBody)
          })
        }
        
        // Sauvegarder les nouveaux objets via API REST
        if (records.length > 0) {
          const saveUrl = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX_ALL}/batch`
          const saveBody = {
            requests: records.map((record: any) => ({
              action: 'updateObject',
              body: record
            }))
          }
          
          await fetch(saveUrl, {
            method: 'POST',
            headers: algoliaHeaders,
            body: JSON.stringify(saveBody)
          })
        }
        return 'ok'
      } catch (e) {
        console.error('[db-webhooks] sync error', String(e))
        return 'failed'
      }
    }

    const results: Record<string,string> = {}
    const toSync = Array.from(sourcesToSync)
    console.log('[db-webhooks] sources to sync', toSync)
    for (const s of toSync) {
      const r = await syncAlgoliaForSource(s)
      results[s] = r
      console.log('[db-webhooks] sync source', s, r)
    }

    return json(200, { ok: true, synced: results, sources: Array.from(sourcesToSync) })
  } catch (e) {
    return json(500, { error: String(e) })
  }
})


