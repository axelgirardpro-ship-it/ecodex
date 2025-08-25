// @ts-nocheck
/* eslint-disable */
// Import privé (user): parse fichier depuis Storage, ingestion SCD2 en bulk,
// refresh projection par source, sync Algolia incrémentale (updateObject)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

type Json = Record<string, any>

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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

async function readCsvLines(url: string) {
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

async function readGzipCsvLines(url: string) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error('Cannot fetch GZ CSV from storage');
  // @ts-ignore
  const decompressed = res.body.pipeThrough(new DecompressionStream('gzip'));
  const reader = decompressed.getReader();
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

async function readXlsxLines(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Cannot fetch XLSX from storage');
  const arrayBuffer = await res.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const csvString = XLSX.utils.sheet_to_csv(worksheet);
  return csvString.split(/\r?\n/).filter(l => l !== '');
}

async function readFileLines(url: string) {
  const lower = url.toLowerCase();
  const isXlsx = lower.includes('.xlsx');
  const isGz = lower.endsWith('.gz') || lower.includes('.csv.gz');
  if (isXlsx) return readXlsxLines(url);
  if (isGz) return readGzipCsvLines(url);
  return readCsvLines(url);
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

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!authHeader) return json(401, { error: 'Missing bearer token' })
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader)
    if (authErr || !user) return json(401, { error: 'Invalid token' })

    const body = await req.json().catch(()=> ({})) as any
    const filePath = String(body.file_path || '')
    const language = String(body.language || 'fr')
    const datasetName = String(body.dataset_name || '')

    if (!filePath || !datasetName) return json(400, { error: 'file_path and dataset_name are required' })

    const { data: signed, error: signedErr } = await supabase.storage.from('imports').createSignedUrl(filePath, 3600)
    if (signedErr || !signed?.signedUrl) return json(500, { error: 'Cannot sign storage url' })

    const lines = await readFileLines(signed.signedUrl)
    if (lines.length < 2) return json(400, { error: 'Empty file' })

    const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''))
    const required = ['Nom','FE','Unité donnée d\'activité','Source','Périmètre','Localisation','Date']
    const lowerHeaders = headers.map(h => h.toLowerCase())
    const missing = required.filter(r => !lowerHeaders.includes(r.toLowerCase()))
    if (missing.length) return json(400, { error: 'Missing headers', missing })

    // Récupérer le workspace de l'utilisateur
    const { data: profile } = await supabase.from('profiles').select('workspace_id').eq('id', user.id).single()
    const userWorkspaceId = (profile as any)?.workspace_id || null
    if (!userWorkspaceId) return json(400, { error: 'No workspace bound to user' })

    const importInsert = await supabase
      .from('data_imports')
      .insert({
        user_id: user.id,
        storage_path: filePath,
        file_name: filePath.split('/').pop(),
        language,
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .select('*')
      .single()
    if (importInsert.error) return json(500, { error: 'Failed to create import record' })
    const importId = (importInsert.data as any).id

    // Upsert source + assignation au workspace
    await supabase.from('fe_sources').upsert({ source_name: datasetName, access_level: 'standard', is_global: false }, { onConflict: 'source_name' })
    await supabase.from('fe_source_workspace_assignments').upsert({ source_name: datasetName, workspace_id: userWorkspaceId, assigned_by: user.id }, { onConflict: 'source_name,workspace_id' })

    // Ingestion SCD2 en bulk
    const t0 = Date.now()
    const toNumber = (s: string) => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) ? n : null }
    const toInt = (s: string) => { const n = parseInt(String(s).replace(/[^0-9-]/g, ''), 10); return Number.isFinite(n) ? n : null }

    let processed = 0, inserted = 0
    for (let i = 1; i < lines.length; i += 1000) {
      const slice = lines.slice(i, i + 1000)
      const batch: any[] = []
      for (let j = 0; j < slice.length; j++) {
        const values = slice[j].split(',')
        const row: Record<string,string> = {}
        headers.forEach((h, idx) => { row[h] = (values[idx] ?? '').trim().replace(/"/g, '') })
        const rowOk = row['Nom'] && row['FE'] && row["Unité donnée d'activité"] && row['Source'] && row['Périmètre'] && row['Localisation'] && row['Date']
        if (!rowOk) continue
        processed++
        const factorKey = (row['ID'] && row['ID'].trim()) ? row['ID'].trim() : computeFactorKey(row, language)
        const versionId = (globalThis.crypto?.randomUUID?.() as string) || `${Date.now()}-${Math.random().toString(36).substring(2)}`
        const rec: any = {
          factor_key: factorKey,
          version_id: versionId,
          is_latest: true,
          valid_from: new Date().toISOString(),
          language,
          "Nom": row['Nom'],
          "Description": row['Description'] || null,
          "FE": toNumber(row['FE']),
          "Unité donnée d'activité": row["Unité donnée d'activité"],
          "Source": datasetName,
          "Secteur": row['Secteur'] || null,
          "Sous-secteur": row['Sous-secteur'] || null,
          "Localisation": row['Localisation'],
          "Date": toInt(row['Date']),
          "Incertitude": row['Incertitude'] || null,
          "Périmètre": row['Périmètre'] || null,
          "Contributeur": row['Contributeur'] || null,
          "Commentaires": row['Commentaires'] || null,
          "Nom_en": row['Nom_en'] || null,
          "Description_en": row['Description_en'] || null,
          "Commentaires_en": row['Commentaires_en'] || null,
          "Secteur_en": row['Secteur_en'] || null,
          "Sous-secteur_en": row['Sous-secteur_en'] || null,
          "Périmètre_en": row['Périmètre_en'] || null,
          "Localisation_en": row['Localisation_en'] || null,
          "Unite_en": row['Unite_en'] || null,
        }
        batch.push(rec)
      }

      // Fermer is_latest existants pour ce batch
      const keys = batch.map(b => b.factor_key)
      if (keys.length) {
        await supabase.from('emission_factors').update({ is_latest: false, valid_to: new Date().toISOString() }).in('factor_key', keys).eq('language', language).eq('is_latest', true)
        const { error: insErr } = await supabase.from('emission_factors').insert(batch)
        if (!insErr) inserted += batch.length
      }
    }
    const db_ms = Date.now() - t0

    // Projection par source (datasetName)
    const t1 = Date.now()
    await supabase.rpc('refresh_ef_all_for_source', { p_source: datasetName })
    const projection_ms = Date.now() - t1

    // Algolia incrémental: updateObject pour la source
    let algolia_ms = 0
    let algolia_api_calls = 0
    if (ALGOLIA_APP_ID && ALGOLIA_ADMIN_KEY) {
      const a0 = Date.now()
      const { data: rows, error } = await supabase
        .from('emission_factors_all_search')
        .select('*')
        .eq('Source', datasetName)
      if (!error && rows && rows.length) {
        const headersA = {
          'X-Algolia-API-Key': ALGOLIA_ADMIN_KEY,
          'X-Algolia-Application-Id': ALGOLIA_APP_ID,
          'Content-Type': 'application/json'
        }
        const requests = rows.map((r: any) => ({ action: 'updateObject', body: { ...r, objectID: String(r.object_id) } }))
        for (let i = 0; i < requests.length; i += 1000) {
          const chunk = requests.slice(i, i + 1000)
          await fetch(`https://${ALGOLIA_APP_ID}-dsn.algolia.net/1/indexes/${ALGOLIA_INDEX_ALL}/batch`, {
            method: 'POST', headers: headersA, body: JSON.stringify({ requests: chunk })
          })
          algolia_api_calls += 1
          // petit délai pour éviter 429
          if (i + 1000 < requests.length) await new Promise(res => setTimeout(res, 100))
        }
      }
      algolia_ms = Date.now() - a0
    }

    await supabase.from('data_imports').update({
      status: 'completed',
      processed,
      inserted,
      db_ms,
      projection_ms,
      algolia_ms,
      algolia_api_calls,
      finished_at: new Date().toISOString()
    }).eq('id', importId)

    return json(200, { ok: true, import_id: importId, processed, inserted })
  } catch (e) {
    return json(500, { error: String(e) })
  }
})


