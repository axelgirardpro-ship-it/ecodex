// Edge Function ADMIN (renommée): analyse + import SCD2, puis reindex atomique déclenché côté admin
// @ts-ignore - Import ESM valide pour Deno/Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// @ts-ignore - Import XLSX pour parsing Excel
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'
// Parsing CSV en streaming pour gros fichiers

// Types pour l'environnement Deno/Edge Functions
interface DenoEnv {
  get(key: string): string | undefined;
}

interface DenoGlobal {
  env: DenoEnv;
  serve(handler: (req: Request) => Promise<Response> | Response): void;
}

declare const Deno: DenoGlobal;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function formatError(err: any): string {
  try {
    if (!err) return 'unknown_error';
    if (typeof err === 'string') return err;
    const message = err.message || err.error_description || err.msg || err.code || 'error';
    const details = err.details || err.hint || err.explanation || '';
    return details ? `${message} | ${details}` : String(message);
  } catch {
    return String(err);
  }
}

// Helpers de parsing/streaming pour gros CSV
function parseCSVLineStreaming(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  let i = 0
  while (i < line.length) {
    const char = line[i]
    const nextChar = line[i + 1]
    if (char === '"') {
      if (inQuotes && nextChar === '"') { current += '"'; i += 2 } else { inQuotes = !inQuotes; i += 1 }
    } else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; i += 1 }
    else { current += char; i += 1 }
  }
  result.push(current.trim())
  return result
}

async function openTextStream(url: string): Promise<ReadableStream<string>> {
  const res = await fetch(url)
  if (!res.ok || !res.body) throw new Error('Cannot fetch file from storage')
  const isGz = url.toLowerCase().endsWith('.gz') || url.toLowerCase().includes('.csv.gz')
  // @ts-ignore
  const base = isGz ? res.body.pipeThrough(new DecompressionStream('gzip')) : res.body
  // @ts-ignore
  return base.pipeThrough(new TextDecoderStream())
}

async function* iterateLines(textStream: ReadableStream<string>): AsyncGenerator<string> {
  const reader = textStream.getReader()
  let { value, done } = await reader.read()
  let buffer = ''
  while (!done) {
    buffer += value || ''
    let idx = buffer.indexOf('\n')
    while (idx !== -1) {
      let line = buffer.slice(0, idx)
      if (line.endsWith('\r')) line = line.slice(0, -1)
      yield line
      buffer = buffer.slice(idx + 1)
      idx = buffer.indexOf('\n')
    }
    ;({ value, done } = await reader.read())
  }
  if (buffer.length > 0) yield buffer
}

function validateRequiredHeaders(headers: string[]): string[] {
  const required = ['Nom', 'FE', "Unité donnée d'activité", 'Source', 'Périmètre', 'Localisation', 'Date']
  const lower = headers.map(h => h.toLowerCase())
  return required.filter(col => !lower.includes(col.toLowerCase()))
}

async function streamAnalyzeCsv(url: string, _language: string) {
  const textStream = await openTextStream(url)
  const errors: string[] = []
  let headers: string[] | null = null
  let processed = 0
  let idsMissing = 0
  const sourcesCount = new Map<string, number>()
  for await (const line of iterateLines(textStream)) {
    if (headers === null) { headers = parseCSVLineStreaming(line); const missing = validateRequiredHeaders(headers); if (missing.length) throw new Error(`Colonnes manquantes: ${missing.join(', ')}`); continue }
    if (!line || line.trim() === '') continue
    const values = parseCSVLineStreaming(line)
    if (values.length !== headers.length) { if (errors.length < 20) errors.push(`Colonnes ${values.length}/${headers.length}`); continue }
    const row: Record<string,string> = {}; headers.forEach((h, idx) => { row[h] = values[idx] || '' })
    const source = row['Source']?.trim(); const nom = row['Nom']?.trim(); const fe = row['FE']?.trim()
    if (!source || !nom || !fe) { if (errors.length < 20) errors.push(`Champs manquants`); continue }
    processed++; if (!row['ID'] || !row['ID'].trim()) idsMissing++
    if (source) sourcesCount.set(source, (sourcesCount.get(source) || 0) + 1)
  }
  return { headers: headers || [], processed, idsMissing, errors, sourcesCount }
}

async function collectSources(url: string): Promise<Set<string>> {
  const textStream = await openTextStream(url)
  const set = new Set<string>()
  let headers: string[] | null = null
  for await (const line of iterateLines(textStream)) {
    if (headers === null) { headers = parseCSVLineStreaming(line); continue }
    if (!line || line.trim() === '') continue
    const values = parseCSVLineStreaming(line)
    if (values.length < (headers?.length || 0)) continue
    const idx = headers!.indexOf('Source')
    if (idx >= 0 && values[idx]) set.add(values[idx].trim())
  }
  return set
}

async function streamImportCsvReplaceAll(url: string, language: string, mapping: Record<string, { access_level: 'standard' | 'premium'; is_global?: boolean }>, supabase: any, user: any) {
  // SUPRA-ADMIN: Streaming par chunks + TRUNCATE initial (évite WORKER_LIMIT)
  const { data: roles } = await supabase.from('user_roles').select('workspace_id, role').eq('user_id', user.id)
  let userWorkspaceId: string | null = null
  if (roles && roles.length > 0) {
    const priority: Record<string, number> = { super_admin: 0, admin: 1, gestionnaire: 2, lecteur: 3 }
    const sorted = roles.slice().sort((a: any, b: any) => (priority[a.role] ?? 99) - (priority[b.role] ?? 99))
    userWorkspaceId = (sorted[0] as any)?.workspace_id || null
  } else {
    const { data: ownedWs } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).limit(1).maybeSingle()
    userWorkspaceId = (ownedWs as any)?.id || null
  }
  
  // TRUNCATE initial pour replace all
  await supabase.from('emission_factors').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  
  const sourcesSet = new Set<string>()
  const textStream = await openTextStream(url)
  let headers: string[] | null = null
  let processed = 0
  let inserted = 0
  let batch: any[] = []
  const chunkSize = Number(Deno.env.get('IMPORT_CHUNK_SIZE') || '100') // Chunks très petits pour éviter timeout
  const toNumber = (s: string) => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) ? n : null }
  const toInt = (s: string) => { const n = parseInt(String(s).replace(/[^0-9-]/g, ''), 10); return Number.isFinite(n) ? n : null }
  
  async function flush() {
    if (batch.length === 0) return
    // INSERT direct sans RPC (plus rapide, moins de timeout)
    const { data: result, error: insertErr } = await supabase.from('emission_factors').insert(batch).select('id')
    if (insertErr) throw insertErr
    inserted += result?.length || 0
    batch = []
  }
  // Streaming par chunks (évite WORKER_LIMIT Edge Functions)
  let lineCount = 0
  for await (const line of iterateLines(textStream)) {
    lineCount++
    if (headers === null) { 
      headers = parseCSVLineStreaming(line)
      console.log(`📋 Headers détectés (${headers.length}):`, headers.slice(0,10))
      continue 
    }
    if (!line || line.trim() === '') continue
    const values = parseCSVLineStreaming(line)
    if (values.length !== headers.length) continue
    const row: Record<string,string> = {}; headers.forEach((h, idx) => { row[h] = values[idx] || '' })
    
    // Validation stricte
    const hasRequired = Boolean(
      row['Nom'] && row['FE'] && row["Unité donnée d'activité"] && row['Source'] && row['Périmètre'] && row['Localisation'] && row['Date']
    )
    const feNum = toNumber(row['FE'])
    if (!hasRequired || feNum === null) continue
    
    processed++
    if (row['Source'] && row['Source'].trim()) sourcesSet.add(row['Source'].trim())
    const factorKey = (row['ID'] && row['ID'].trim()) ? row['ID'].trim() : computeFactorKey(row, language)
    
    batch.push({
      factor_key: factorKey,
      version_id: (globalThis.crypto?.randomUUID?.() as string) || `${Date.now()}-${Math.random().toString(36).substring(2)}`,
      is_latest: true,
      valid_from: new Date().toISOString(),
      language,
      "Nom": row['Nom'],
      "Description": row['Description'] || null,
      "FE": feNum,
      "Unité donnée d'activité": row["Unité donnée d'activité"],
      "Source": row['Source'],
      "Secteur": row['Secteur'] || 'Non spécifié', // NOT NULL constraint
      "Sous-secteur": row['Sous-secteur'] || null,
      "Localisation": row['Localisation'],
      "Date": toInt(row['Date']),
      "Incertitude": row['Incertitude'] || null,
      "Périmètre": row['Périmètre'] || null,
      "Contributeur": row['Contributeur'] || null,
      "Contributeur_en": row['Contributeur_en'] || null,
      "Méthodologie": row['Méthodologie'] || null,
      "Méthodologie_en": row['Méthodologie_en'] || null,
      "Type_de_données": row['Type_de_données'] || null,
      "Type_de_données_en": row['Type_de_données_en'] || null,
      "Commentaires": row['Commentaires'] || null,
      "Nom_en": row['Nom_en'] || null,
      "Description_en": row['Description_en'] || null,
      "Commentaires_en": row['Commentaires_en'] || null,
      "Secteur_en": row['Secteur_en'] || null,
      "Sous-secteur_en": row['Sous-secteur_en'] || null,
      "Périmètre_en": row['Périmètre_en'] || null,
      "Localisation_en": row['Localisation_en'] || null,
      "Unite_en": row['Unite_en'] || null,
    })
    
    if (batch.length >= chunkSize) await flush()
  }
  await flush()
  
  console.log(`📊 Streaming terminé: ${lineCount} lignes lues, ${processed} lignes traitées, ${inserted} insérés`)
  // Upsert en masse des sources et assignations après ingestion
  const allSources = Array.from(sourcesSet)
  if (allSources.length > 0) {
    const sourcesRows = allSources.map((name) => {
      const cfg = mapping?.[name] || { access_level: 'standard', is_global: true }
      return { source_name: name, access_level: cfg.access_level, is_global: cfg.is_global }
    })
    await supabase.from('fe_sources').upsert(sourcesRows, { onConflict: 'source_name' })
    if (userWorkspaceId) {
      const assignRows = allSources
        .filter((name) => {
          const cfg = mapping?.[name] || { access_level: 'standard', is_global: true }
          return !cfg.is_global
        })
        .map((name) => ({ source_name: name, workspace_id: userWorkspaceId, assigned_by: user.id }))
      if (assignRows.length > 0) {
        await supabase.from('fe_source_workspace_assignments').upsert(assignRows, { onConflict: 'source_name,workspace_id' })
      }
    }
  }
  return { inserted, processed, sources: allSources }
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
  // Décompresser en streaming
  // @ts-ignore - DecompressionStream est dispo en Deno Edge
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

async function readXlsxLines(url: string, maxErrors = 50) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Cannot fetch XLSX from storage');
  
  // Lire le fichier XLSX en ArrayBuffer
  const arrayBuffer = await res.arrayBuffer();
  
  // Parser avec XLSX
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  // Prendre la première feuille
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Convertir en CSV
  const csvString = XLSX.utils.sheet_to_csv(worksheet);
  
  // Retourner les lignes comme pour CSV
  return csvString.split(/\r?\n/).filter(l => l !== '');
}

// Supprimé: lecture entière non streaming (remplacée par openTextStream/iterateLines)

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
    const replaceAll = Boolean(body?.replace_all);
    const mapping = (body?.mapping || {}) as Record<string, { access_level: 'standard' | 'premium'; is_global?: boolean }>;

    if (!filePath) return new Response(JSON.stringify({ error: 'file_path is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const fileNameOnly = (filePath || '').split('/').pop() || filePath

    const { data: importRecord, error: importError } = await supabase
      .from('data_imports')
      .insert({
        user_id: user.id,
        storage_path: filePath,
        file_name: fileNameOnly,
        status: dryRun ? 'analyzing' : 'processing',
        language,
        started_at: new Date().toISOString()
      })
      .select()
      .single()

    if (importError) return new Response(JSON.stringify({ error: 'Failed to create import record' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const { data: signed, error: signedErr } = await supabase.storage.from('imports').createSignedUrl(filePath, 3600)
    if (signedErr || !signed?.signedUrl) {
      await supabase.from('data_imports').update({ status: 'failed', error_details: { error: 'signed url failure' }, finished_at: new Date().toISOString() }).eq('id', importRecord.id)
      return new Response(JSON.stringify({ error: 'Cannot sign storage url' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Streaming: analyse si dry_run; sinon ingestion par flux
    if (dryRun) {
      const analysis = await streamAnalyzeCsv(signed.signedUrl, language)
      await supabase.from('data_imports').update({ status: 'analyzed', processed: analysis.processed, failed: analysis.errors.length, error_samples: analysis.errors.length ? JSON.stringify({ errors: analysis.errors }) : null }).eq('id', importRecord.id)
      const sources = Array.from(analysis.sourcesCount.entries()).map(([name, count]) => ({ name, count, access_level: mapping?.[name]?.access_level || 'standard', is_global: mapping?.[name]?.is_global ?? true }))
      return new Response(JSON.stringify({ import_id: importRecord.id, total_rows: analysis.processed, processed: analysis.processed, errors_sample: analysis.errors.slice(0, 20), ids_missing: analysis.idsMissing, sources }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Non dry-run – Créer un job asynchrone pour traitement en arrière-plan
    try {
      // Créer le job d'import dans la table
      const { data: job, error: jobErr } = await supabase
        .from('import_jobs')
        .insert({
          user_id: user.id,
          file_path: filePath,
          file_name: fileNameOnly,
          language,
          mapping,
          replace_all: replaceAll,
          status: 'queued'
        })
        .select()
        .single()

      if (jobErr) throw jobErr

      // Envoyer le job dans la queue pgmq (traitement asynchrone)
      const { error: queueErr } = await supabase.rpc('pgmq.send', {
        queue_name: 'import_jobs',
        msg: {
          job_id: job.id,
          user_id: user.id,
          file_path: filePath,
          language,
          replace_all: replaceAll,
          mapping
        }
      })
      
      if (queueErr) {
        console.warn('Queue send failed:', queueErr)
        // Fallback: marquer comme queued, le cron le trouvera
      }

      await supabase.from('data_imports').update({ 
        status: 'queued', 
        finished_at: new Date().toISOString() 
      }).eq('id', importRecord.id)

      return new Response(JSON.stringify({ 
        import_id: importRecord.id, 
        job_id: job.id,
        status: 'queued',
        message: 'Import job créé. Traitement en arrière-plan en cours.'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    } catch (e) {
      const errText = formatError(e)
      await supabase.from('data_imports').update({ status: 'failed', error_details: { error: errText }, finished_at: new Date().toISOString() }).eq('id', importRecord.id)
      return new Response(JSON.stringify({ error: errText }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: formatError(error) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})