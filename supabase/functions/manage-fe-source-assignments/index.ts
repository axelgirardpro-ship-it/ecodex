import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, Authorization, Content-Type, X-Client-Info',
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Max-Age': '86400',
	'Vary': 'Origin',
}

function json(status: number, body: unknown) {
	return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type Action = 'assign' | 'unassign'

Deno.serve(async (req) => {
	try {
		if (req.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: corsHeaders })
		}
		if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

		const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
		const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
		if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: 'Supabase environment not configured' })

		const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
		const debug: Record<string, unknown> = {}

		async function syncAlgoliaForSource(sourceName: string): Promise<'ok'|'skipped'|'failed'> {
			const ALGOLIA_APP_ID = Deno.env.get('ALGOLIA_APP_ID') ?? ''
			const ALGOLIA_ADMIN_KEY = Deno.env.get('ALGOLIA_ADMIN_KEY') ?? ''
			const ALGOLIA_INDEX_ALL = Deno.env.get('ALGOLIA_INDEX_ALL') ?? 'ef_all'
			if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) return 'skipped'
			try {
				// Utiliser l'API REST Algolia directement avec fetch (compatible Deno/Edge Functions)
				const algoliaHeaders = {
					'X-Algolia-API-Key': ALGOLIA_ADMIN_KEY,
					'X-Algolia-Application-Id': ALGOLIA_APP_ID,
					'Content-Type': 'application/json'
				}

    const { data: rows, error } = await supabase
        .from('emission_factors_all_search')
        .select('*')
        .eq('Source', sourceName)
				if (error) throw new Error(`Projection fetch failed: ${error.message}`)

				const records = (rows || []).map((r: any) => ({ ...r, objectID: String(r.object_id) }))
				const currentIds = new Set(records.map((r: any) => r.objectID))

				// Récupérer les objectID existants pour cette Source via API REST
				const existingIds: string[] = []
				const searchUrl = `https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX_ALL}/query`
				const searchBody = {
					query: '',
					filters: `Source:"${sourceName.replaceAll('"', '\\"')}"`,
					attributesToRetrieve: ['objectID'],
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
				console.error('ALGOLIA_SYNC_ERROR', String(e))
				debug.algolia_error = String(e)
				return 'failed'
			}
		}

		const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
		if (!authHeader) return json(401, { error: 'Missing bearer token' })
		const { data: userRes, error: userErr } = await supabase.auth.getUser(authHeader)
		if (userErr || !userRes?.user) return json(401, { error: 'Unauthorized' })

		const { data: isSupra, error: roleErr } = await supabase.rpc('is_supra_admin', { user_uuid: userRes.user.id })
		if (roleErr) return json(500, { error: 'Authorization check failed' })
		if (!isSupra) return json(403, { error: 'Access denied - supra admin required' })

		const body = await req.json()
		const action: Action = body?.action
		const source_name: string = body?.source_name
		const workspace_id: string = body?.workspace_id

		if (!action || (action !== 'assign' && action !== 'unassign')) return json(400, { error: 'Invalid action' })
		if (!source_name || !workspace_id) return json(400, { error: 'Missing source_name or workspace_id' })

		let projection_refresh: 'ok'|'failed' = 'ok'

		if (action === 'assign') {
			const { error } = await supabase
				.from('fe_source_workspace_assignments')
				.upsert({ source_name, workspace_id, assigned_by: userRes.user.id }, { onConflict: 'source_name,workspace_id' })
			if (error) return json(500, { error: error.message })
			try {
    const { error: refreshErr } = await supabase.rpc('refresh_ef_all_for_source', { p_source: source_name })
				if (refreshErr) { projection_refresh = 'failed'; debug.rpc_error = refreshErr.message }
			} catch (e) {
				projection_refresh = 'failed'
				debug.rpc_exception = String(e)
			}
			const sync = await syncAlgoliaForSource(source_name)
			return json(200, { ok: true, action, source_name, workspace_id, projection_refresh, algolia_sync: sync, debug })
		} else {
			const { error } = await supabase
				.from('fe_source_workspace_assignments')
				.delete()
				.eq('source_name', source_name)
				.eq('workspace_id', workspace_id)
			if (error) return json(500, { error: error.message })
			try {
				const { error: refreshErr } = await supabase.rpc('refresh_ef_all_for_source', { p_source: source_name })
				if (refreshErr) { projection_refresh = 'failed'; debug.rpc_error = refreshErr.message }
			} catch (e) {
				projection_refresh = 'failed'
				debug.rpc_exception = String(e)
			}
			const sync = await syncAlgoliaForSource(source_name)
			return json(200, { ok: true, action, source_name, workspace_id, projection_refresh, algolia_sync: sync, debug })
		}
	} catch (e) {
		return json(500, { error: String(e) })
	}
})


