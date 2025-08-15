import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function computeFactorKey(row: Record<string,string>, language: string) {
  const nom = (row['Nom'] || '').toLowerCase().trim();
  const unite = (row["Unité donnée d'activité"] || '').toLowerCase().trim();
  const source = (row['Source'] || '').toLowerCase().trim();
  const perimetre = (row['Périmètre'] || '').toLowerCase().trim();
  const localisation = (row['Localisation'] || '').toLowerCase().trim();
  const lang = (language || 'fr').toLowerCase().trim();
  return [nom, unite, source, perimetre, localisation, lang].join('|');
}

async function readCsvLines(url: string, maxErrors = 50) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error('Cannot fetch CSV from storage');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let { value, done } = await reader.read();
  let buffer = value ? decoder.decode(value, { stream: true }) : '';
  const lines: string[] = [];
  while (!done) {
    const parts = buffer.split(/\r?\n/);
    buffer = parts.pop() || '';
    lines.push(...parts);
    ({ value, done } = await reader.read());
    if (value) buffer += decoder.decode(value, { stream: true });
  }
  if (buffer.length > 0) lines.push(buffer);
  return lines.filter(l => l !== '');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!authHeader) return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader)
    if (authError || !user) return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: supaAdminCheck, error: roleError } = await supabase.rpc('is_supra_admin', { user_uuid: user.id })
    if (roleError || !supaAdminCheck) return new Response(JSON.stringify({ error: 'Access denied - supra admin required' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const body = await req.json();
    const filePath = body?.file_path as string;
    const language = (body?.language as string) || 'fr';
    const dryRun = Boolean(body?.dry_run);
    const mapping = (body?.mapping || {}) as Record<string, { access_level: 'standard' | 'premium'; is_global?: boolean }>;

    if (!filePath) return new Response(JSON.stringify({ error: 'file_path is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: importRecord, error: importError } = await supabase
      .from('data_imports')
      .insert({ user_id: user.id, file_path: filePath, status: dryRun ? 'analyzing' : 'processing', language, started_at: new Date().toISOString() })
      .select()
      .single()

    if (importError) return new Response(JSON.stringify({ error: 'Failed to create import record' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: signed, error: signedErr } = await supabase.storage.from('imports').createSignedUrl(filePath, 3600)
    if (signedErr || !signed?.signedUrl) {
      await supabase.from('data_imports').update({ status: 'failed', error_details: { error: 'signed url failure' }, finished_at: new Date().toISOString() }).eq('id', importRecord.id)
      return new Response(JSON.stringify({ error: 'Cannot sign storage url' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const lines = await readCsvLines(signed.signedUrl)
    if (lines.length < 2) {
      await supabase.from('data_imports').update({ status: 'failed', error_details: { error: 'empty csv' }, finished_at: new Date().toISOString() }).eq('id', importRecord.id)
      return new Response(JSON.stringify({ error: 'CSV vide' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''))
    const lowerHeaders = headers.map(h => h.toLowerCase())
  const required = ['Nom','FE','Unité donnée d\'activité','Source','Périmètre','Localisation','Date']
    const missing = required.filter(r => !lowerHeaders.includes(r.toLowerCase()))

    const sourcesCount = new Map<string, number>()
    const errors: string[] = []
    let processed = 0
    let idsMissing = 0

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (!line) continue
      const values = line.split(',')
      const row: Record<string,string> = {}
      headers.forEach((h, idx) => { row[h] = (values[idx] ?? '').trim().replace(/"/g, '') })

      const rowOk = row['Nom'] && row['FE'] && row["Unité donnée d'activité"] && row['Source'] && row['Périmètre'] && row['Localisation'] && row['Date']
      if (!rowOk) {
        if (errors.length < 50) errors.push(`Ligne ${i+1}: champs requis manquants`)
        continue
      }
      processed++
      const src = row['Source']
      sourcesCount.set(src, (sourcesCount.get(src) || 0) + 1)

      const providedId = (row['ID'] || '').trim()
      if (!providedId) idsMissing++
    }

    if (dryRun) {
      await supabase.from('data_imports').update({ status: 'analyzed', processed: processed, failed: errors.length, error_samples: errors.length ? JSON.stringify({ errors }) : null }).eq('id', importRecord.id)
      const sources = Array.from(sourcesCount.entries()).map(([name, count]) => ({ name, count, access_level: mapping?.[name]?.access_level || 'standard', is_global: mapping?.[name]?.is_global ?? true }))
      return new Response(JSON.stringify({ import_id: importRecord.id, total_rows: lines.length - 1, processed, errors_sample: errors.slice(0, 20), missing_headers: missing, ids_missing: idsMissing, sources }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Non dry-run – pipeline: upsert fe_sources + SCD2 par factor_key (ID prioritaire)
    try {
      // Récupérer le workspace de l'utilisateur pour les assignations
      const { data: profile } = await supabase
        .from('profiles')
        .select('workspace_id')
        .eq('id', user.id)
        .single()
      
      const userWorkspaceId = profile?.workspace_id

      for (const [name] of sourcesCount) {
        const cfg = mapping?.[name] || { access_level: 'standard', is_global: true }
        await supabase.from('fe_sources').upsert({ source_name: name, access_level: cfg.access_level, is_global: cfg.is_global }, { onConflict: 'source_name' })
        
        // IMPORTANT: Pour les imports utilisateur (non globaux), assigner automatiquement au workspace
        if (!cfg.is_global && userWorkspaceId) {
          await supabase
            .from('fe_source_workspace_assignments')
            .upsert({ 
              source_name: name, 
              workspace_id: userWorkspaceId,
              assigned_by: user.id
            }, { onConflict: 'source_name,workspace_id' })
        }
      }

      let inserted = 0
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',')
        const row: Record<string,string> = {}
        headers.forEach((h, idx) => { row[h] = (values[idx] ?? '').trim().replace(/"/g, '') })
        const rowOk = row['Nom'] && row['FE'] && row["Unité donnée d'activité"] && row['Source'] && row['Périmètre'] && row['Localisation'] && row['Date']
        if (!rowOk) continue

        const factorKey = (row['ID'] && row['ID'].trim()) ? row['ID'].trim() : computeFactorKey(row, language)

        // Close previous latest
        await supabase
          .from('emission_factors')
          .update({ is_latest: false, valid_to: new Date().toISOString() })
          .eq('factor_key', factorKey)
          .eq('language', language)
          .eq('is_latest', true)

        const toNumber = (s: string) => {
          const n = parseFloat(String(s).replace(',', '.'))
          return Number.isFinite(n) ? n : null
        }
        const toInt = (s: string) => {
          const n = parseInt(String(s).replace(/[^0-9-]/g, ''), 10)
          return Number.isFinite(n) ? n : null
        }

        const versionId = (globalThis.crypto?.randomUUID?.() as string) || '00000000-0000-0000-0000-000000000000'

        const record: any = {
          factor_key: factorKey,
          version_id: versionId,
          is_latest: true,
          valid_from: new Date().toISOString(),
          language,
          // Colonnes métier (respecter la casse/accents côté Postgres)
          "Nom": row['Nom'],
          "Description": row['Description'] || null,
          "FE": toNumber(row['FE']),
          "Unité donnée d'activité": row["Unité donnée d'activité"],
          "Source": row['Source'],
          "Secteur": row['Secteur'] || null,
          "Sous-secteur": row['Sous-secteur'] || null,
          "Localisation": row['Localisation'],
          "Date": toInt(row['Date']),
          "Incertitude": row['Incertitude'] || null,
          "Périmètre": row['Périmètre'] || null,
          "Contributeur": row['Contributeur'] || null,
          "Commentaires": row['Commentaires'] || null,
          // Champs EN (optionnels)
          "Nom_en": row['Nom_en'] || null,
          "Description_en": row['Description_en'] || null,
          "Commentaires_en": row['Commentaires_en'] || null,
          "Secteur_en": row['Secteur_en'] || null,
          "Sous-secteur_en": row['Sous-secteur_en'] || null,
          "Périmètre_en": row['Périmètre_en'] || null,
          "Localisation_en": row['Localisation_en'] || null,
          "Unite_en": row['Unite_en'] || null,
        }

        const { error: insertError } = await supabase.from('emission_factors').insert(record)
        if (!insertError) inserted++
      }

      // Déclencher rebuild des projections (public/private FR)
      const { error: rebuildError } = await supabase.rpc('rebuild_after_import_fr', { p_import_id: importRecord.id })
      if (rebuildError) {
        await supabase.from('data_imports').update({ status: 'failed', error_details: { error: 'rebuild failed', details: rebuildError.message }, finished_at: new Date().toISOString(), processed: processed, inserted: inserted }).eq('id', importRecord.id)
        return new Response(JSON.stringify({ error: 'Rebuild projections failed', details: rebuildError.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Full record updates Algolia par source
      try {
        const ALGOLIA_APP_ID = Deno.env.get('ALGOLIA_APP_ID') ?? ''
        const ALGOLIA_ADMIN_KEY = Deno.env.get('ALGOLIA_ADMIN_KEY') ?? ''
        const ALGOLIA_INDEX_ALL = Deno.env.get('ALGOLIA_INDEX_ALL') ?? 'ef_all'
        if (ALGOLIA_APP_ID && ALGOLIA_ADMIN_KEY) {
          // Utiliser l'API REST Algolia directement avec fetch (compatible Deno/Edge Functions)
          const algoliaHeaders = {
            'X-Algolia-API-Key': ALGOLIA_ADMIN_KEY,
            'X-Algolia-Application-Id': ALGOLIA_APP_ID,
            'Content-Type': 'application/json'
          }

          for (const [sourceName] of sourcesCount) {
            await supabase.rpc('refresh_ef_all_for_source', { p_source: sourceName })

            const { data: rows, error } = await supabase
              .from('emission_factors_all_search')
              .select('*')
              .eq('Source', sourceName)
            if (error) continue

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
          }
        }
      } catch (_) {
        // Ne pas bloquer l'import si la synchro Algolia échoue
      }

      await supabase.from('data_imports').update({ status: 'completed', finished_at: new Date().toISOString(), processed: processed, inserted: inserted }).eq('id', importRecord.id)
      return new Response(JSON.stringify({ import_id: importRecord.id, processed, inserted, status: 'completed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    } catch (e) {
      await supabase.from('data_imports').update({ status: 'failed', error_details: { error: String(e) }, finished_at: new Date().toISOString() }).eq('id', importRecord.id)
      return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as any)?.message || String(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})