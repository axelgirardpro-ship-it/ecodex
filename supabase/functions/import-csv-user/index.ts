// @ts-nocheck
/* eslint-disable */
// Import privé (user): parse fichier depuis Storage, ingestion SCD2 en bulk,
// refresh projection par source, sync Algolia incrémentale (updateObject)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'
// Import du parser CSV robuste
import { RobustCsvParser } from './csv-parser.ts'

type Json = Record<string, any>

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function formatError(err: any): string {
  try {
    if (!err) return 'unknown_error'
    if (typeof err === 'string') return err
    const message = (err as any).message || (err as any).error_description || (err as any).msg || (err as any).code || 'error'
    const details = (err as any).details || (err as any).hint || (err as any).explanation || ''
    return details ? `${message} | ${details}` : String(message)
  } catch {
    return String(err)
  }
}

function formatError(err: any): string {
  try {
    if (!err) return 'unknown_error'
    if (typeof err === 'string') return err
    const message = (err as any).message || (err as any).error_description || (err as any).msg || (err as any).code || 'error'
    const details = (err as any).details || (err as any).hint || (err as any).explanation || ''
    return details ? `${message} | ${details}` : String(message)
  } catch {
    return String(err)
  }
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

async function readCsvContent(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error('Cannot fetch CSV from storage');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let { value, done } = await reader.read();
  let buffer = value ? decoder.decode(value, { stream: true }) : '';
  while (!done) {
    ({ value, done } = await reader.read());
    if (value) buffer += decoder.decode(value, { stream: true });
  }
  return buffer;
}

async function readGzipCsvContent(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error('Cannot fetch GZ CSV from storage');
  // @ts-ignore
  const decompressed = res.body.pipeThrough(new DecompressionStream('gzip'));
  const reader = decompressed.getReader();
  const decoder = new TextDecoder();
  let { value, done } = await reader.read();
  let buffer = value ? decoder.decode(value, { stream: true }) : '';
  while (!done) {
    ({ value, done } = await reader.read());
    if (value) buffer += decoder.decode(value, { stream: true });
  }
  return buffer;
}

async function readXlsxContent(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Cannot fetch XLSX from storage');
  const arrayBuffer = await res.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_csv(worksheet);
}

async function readFileContent(url: string): Promise<string> {
  const lower = url.toLowerCase();
  const isXlsx = lower.includes('.xlsx');
  const isGz = lower.endsWith('.gz') || lower.includes('.csv.gz');
  
  if (isXlsx) {
    console.log('📊 Détection fichier XLSX, parsing Excel...');
    return await readXlsxContent(url);
  } else if (isGz) {
    console.log('🗜️ Détection fichier CSV GZ, décompression streaming...');
    return await readGzipCsvContent(url);
  } else {
    console.log('📄 Détection fichier CSV, parsing texte...');
    return await readCsvContent(url);
  }
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

    // Utiliser le parser robuste au lieu du parsing défaillant
    const fileContent = await readFileContent(signed.signedUrl)
    
    let parsedData;
    try {
      parsedData = RobustCsvParser.parseCSVContent(fileContent);
      console.log(`✅ Parser robuste utilisateur: ${parsedData.rows.length} lignes parsées`);
    } catch (parseError) {
      return json(400, { error: `Erreur de parsing CSV: ${parseError.message}` })
    }

    const { headers, rows } = parsedData;
    
    if (rows.length === 0) {
      return json(400, { error: 'CSV vide après parsing' })
    }

    // Extraire les sources avec validation
    const sourcesCount = RobustCsvParser.extractSourcesFromRows(rows);
    console.log(`🔍 Sources détectées (utilisateur): ${Array.from(sourcesCount.keys()).join(', ')}`);

    // Validation des colonnes requises
    const required = ['Nom','FE','Unité donnée d\'activité','Source','Périmètre','Localisation','Date']
    const lowerHeaders = headers.map(h => h.toLowerCase())
    const missing = required.filter(r => !lowerHeaders.includes(r.toLowerCase()))
    if (missing.length) return json(400, { error: 'Missing headers', missing })

    // Récupérer le workspace de l'utilisateur via user_roles (workspace_id)
    const { data: roles, error: rolesErr } = await supabase
      .from('user_roles')
      .select('workspace_id, role')
      .eq('user_id', user.id)

    if (rolesErr) return json(500, { error: 'Failed to fetch user roles', details: rolesErr.message })

    let userWorkspaceId: string | null = null
    if (roles && roles.length > 0) {
      const priority: Record<string, number> = { super_admin: 0, admin: 1, gestionnaire: 2, lecteur: 3 }
      const sorted = roles.slice().sort((a: any, b: any) => (priority[a.role] ?? 99) - (priority[b.role] ?? 99))
      userWorkspaceId = (sorted[0] as any)?.workspace_id || null
    } else {
      // Fallback: workspace possédé par l'utilisateur (au cas où aucun rôle explicite)
      const { data: ownedWs } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
        .maybeSingle()
      userWorkspaceId = (ownedWs as any)?.id || null
    }

    if (!userWorkspaceId) return json(400, { error: 'No workspace bound to user (via user_roles)' })

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

    // Upsert source + assignation au workspace avec validation
    if (!RobustCsvParser.validateSourceName(datasetName)) {
      return json(400, { error: `Nom de dataset invalide: "${datasetName}" (ne peut pas être un nombre ou une unité)` })
    }
    
    await supabase.from('fe_sources').upsert({ source_name: datasetName, access_level: 'standard', is_global: false }, { onConflict: 'source_name' })
    await supabase.from('fe_source_workspace_assignments').upsert({ source_name: datasetName, workspace_id: userWorkspaceId, assigned_by: user.id }, { onConflict: 'source_name,workspace_id' })

    // Ingestion SCD2 en bulk avec données parsées robustement
    const t0 = Date.now()
    const toNumber = (s: string) => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) ? n : null }
    const toInt = (s: string) => { const n = parseInt(String(s).replace(/[^0-9-]/g, ''), 10); return Number.isFinite(n) ? n : null }

    let processed = 0, inserted = 0
    const CHUNK = Number(Deno.env.get('IMPORT_CHUNK_SIZE') || '500')
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK)
      const batch: any[] = []
      
      for (const row of slice) {
        // Validation supplémentaire des champs critiques
        const rowOk = row['Nom'] && row['FE'] && row["Unité donnée d'activité"] && row['Source'] && row['Périmètre'] && row['Localisation'] && row['Date']
        if (!rowOk) continue
        
        // Validation de la source dans la ligne
        const sourceInRow = row['Source']?.trim();
        if (sourceInRow && !RobustCsvParser.validateSourceName(sourceInRow)) {
          console.warn(`Source invalide ignorée: "${sourceInRow}" (ligne ${processed + 1})`);
          continue;
        }
        
        processed++
        const factorKey = (row['ID'] && row['ID'].trim()) ? row['ID'].trim() : computeFactorKey(row, language)
        const versionId = (globalThis.crypto?.randomUUID?.() as string) || `${Date.now()}-${Math.random().toString(36).substring(2)}`
        
        const rec: any = {
          factor_key: factorKey,
          version_id: versionId,
          is_latest: true,
          valid_from: new Date().toISOString(),
          language,
          workspace_id: userWorkspaceId,
          "Nom": row['Nom'],
          "Description": row['Description'] || null,
          "FE": toNumber(row['FE']),
          "Unité donnée d'activité": row["Unité donnée d'activité"],
          "Source": datasetName, // Utiliser le nom du dataset validé
          "Secteur": row['Secteur'] || null,
          "Sous-secteur": row['Sous-secteur'] || null,
          "Localisation": row['Localisation'],
          "Date": toInt(row['Date']),
          "Incertitude": toNumber(row['Incertitude']),
          "Périmètre": row['Périmètre'],
          "Contributeur": row['Contributeur'] || null,
          "Commentaires": row['Commentaires'] || null,
        }
        batch.push(rec)
      }

      if (batch.length === 0) continue

      // SCD2 via RPC workspace-scoped
      const { data: upserted, error: rpcErr } = await supabase.rpc('batch_upsert_user_emission_factors', { 
        p_workspace_id: userWorkspaceId, 
        p_records: batch 
      })
      if (rpcErr) {
        console.error('Erreur RPC insertion batch utilisateur:', rpcErr)
        await supabase.from('data_imports').update({ status: 'failed', error_details: { error: formatError(rpcErr) }, finished_at: new Date().toISOString() }).eq('id', importId)
        return json(500, { error: 'Database insertion failed', details: formatError(rpcErr) })
      }
      inserted += (upserted as number) || 0
      console.log(`Batch utilisateur ${Math.ceil((i + CHUNK) / CHUNK)} inséré: ${upserted || 0} records`)
    }

    const t1 = Date.now()
    console.log(`Import utilisateur terminé: ${processed} traités, ${inserted} insérés en ${t1 - t0}ms`)

    // Algolia partial update pour user (par source workspace)
    try {
      const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/algolia-batch-optimizer?action=sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: req.headers.get('Authorization') || '' },
        body: JSON.stringify({ sources: [datasetName], operation: 'incremental_sync', priority: 3, estimated_records: inserted })
      })
      const text = await resp.text()
      await supabase.from('audit_logs').insert({ user_id: user.id, action: 'algolia_partial_sync_attempt', details: { sources: [datasetName], status: resp.status, response: text } })
    } catch (e) { await supabase.from('audit_logs').insert({ user_id: user.id, action: 'algolia_partial_sync_error', details: { error: formatError(e) } }) }

    // Finaliser l'import
    await supabase.from('data_imports').update({
      status: 'completed',
      processed,
      inserted,
      updated: 0,
      failed: 0,
      finished_at: new Date().toISOString(),
      db_ms: t1 - t0,
      algolia_api_calls: null
    }).eq('id', importId)

    return json(200, { 
      import_id: importId, 
      processed, 
      inserted, 
      sources: Array.from(sourcesCount.keys()),
      parsing_method: 'robust_csv_parser',
      compression_supported: true
    })

  } catch (error) {
    console.error('Import utilisateur error:', error)
    return json(500, { error: formatError(error) })
  }
})
