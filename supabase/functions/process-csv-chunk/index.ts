// PROCESS CSV CHUNK: Edge Function spécialisée pour traiter un chunk
// @ts-ignore - Import ESM valide pour Deno/Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    if (!err) return 'unknown_error'
    if (typeof err === 'string') return err
    const message = err.message || err.error_description || err.msg || err.code || 'error'
    const details = err.details || err.hint || err.explanation || ''
    return details ? `${message} | ${details}` : String(message)
  } catch {
    return String(err)
  }
}

function transformRow(
  row: Record<string, any>, 
  language: string = 'fr',
  overrideSource?: string,
  workspaceId?: string,
): any {
  const toNumber = (s: string) => { 
    const n = parseFloat(String(s).replace(',', '.'))
    return Number.isFinite(n) ? n : null 
  }
  const toInt = (s: string) => { 
    const n = parseInt(String(s).replace(/[^0-9-]/g, ''), 10)
    return Number.isFinite(n) ? n : null 
  }

  // Source effective (utilisateur: dataset_name)
  const effectiveSource = overrideSource ?? String(row['Source'] || 'Source inconnue')

  // Générer factor_key (dépend de la source effective)
  const factorKey = (row['ID'] && String(row['ID']).trim()) ? 
    String(row['ID']).trim() : 
    `${String(row['Nom'] || '').toLowerCase()}_${String(effectiveSource || '').toLowerCase()}_${String(row['Localisation'] || '').toLowerCase()}_${language}`.replace(/[^a-z0-9_]/g, '_')

  const rec: any = {
    factor_key: factorKey,
    version_id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substring(2)}`,
    is_latest: true,
    valid_from: new Date().toISOString(),
    language,
    "Nom": String(row['Nom'] || ''),
    "Description": row['Description'] || null,
    "FE": toNumber(String(row['FE'] || '0')),
    "Unité donnée d'activité": String(row["Unité donnée d'activité"] || row['Unite'] || 'unité'),
    "Source": effectiveSource,
    "Secteur": String(row['Secteur'] || 'Non spécifié'),
    "Sous-secteur": row['Sous-secteur'] || null,
    "Localisation": String(row['Localisation'] || 'Non spécifié'),
    "Date": toInt(String(row['Date'] || '2025')),
    "Incertitude": row['Incertitude'] || null,
    "Périmètre": String(row['Périmètre'] || 'Non spécifié'),
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
  if (workspaceId) (rec as any).workspace_id = workspaceId
  return rec
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  
  // Capture pour le catch (éviter de relire le body)
  let job_id: string | undefined
  let chunk_number: number | undefined
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    job_id = body?.job_id
    chunk_number = body?.chunk_number
    const overrideMicroBatch = Number(body?.micro_batch_size)
    const MICRO_BATCH_SIZE = Number.isFinite(overrideMicroBatch) && overrideMicroBatch > 0 ? overrideMicroBatch : 25
    
    if (!job_id || chunk_number === undefined) {
      return new Response(JSON.stringify({ error: 'job_id and chunk_number required' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    console.log(`🔄 Processing chunk ${chunk_number} for job ${job_id}`)

    const { data: claimed } = await supabase.rpc('claim_chunk_for_processing', { p_job_id: job_id, p_chunk_number: chunk_number }) as any
    if (claimed !== true) {
      return new Response(JSON.stringify({ error: 'Chunk is locked by another worker' }), { status: 423, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Récupérer le chunk depuis la vraie table
    const { data: chunk, error: chunkErr } = await supabase
      .from('import_chunks')
      .select('*')
      .eq('job_id', job_id)
      .eq('chunk_number', chunk_number)
      .eq('processed', false)
      .single()
    
    if (chunkErr || !chunk) {
      // Fallback: chercher dans data_imports si pas trouvé dans import_chunks
      console.log('Chunk not found in import_chunks, checking data_imports...')
      return new Response(JSON.stringify({ 
        error: 'Chunk not found or already processed',
        details: `job_id: ${job_id}, chunk_number: ${chunk_number}`
      }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Récupérer le job depuis la vraie table (import_jobs ou data_imports)
    let job: any = null
    const { data: importJob, error: importJobErr } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', job_id)
      .maybeSingle()
    
    if (importJob) {
      job = importJob
    } else {
      // Fallback: chercher dans data_imports
      const { data: dataImport, error: dataImportErr } = await supabase
        .from('data_imports')
        .select('*')
        .eq('id', job_id)
        .maybeSingle()
      
      if (dataImport) {
        job = { ...dataImport, language: dataImport.language || 'fr', replace_all: true }
      }
    }
    
    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found in any table' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const chunkData = Array.isArray(chunk.data) ? chunk.data : []
    let processedCount = 0
    let insertedCount = 0

    console.log(`📊 Processing chunk ${chunk_number}: ${chunkData.length} records`)

    // Désactiver temporairement les webhooks pour éviter les appels massifs
    let triggersDisabled = false
    try {
      try { await supabase.rpc('disable_emission_factors_triggers') } catch (_) {}
      try { await supabase.rpc('disable_emission_factors_all_search_triggers') } catch (_) {}
      triggersDisabled = true

      // Traiter par micro-batches pour éviter timeout
      const isUserJob = String(job?.job_kind || '') === 'user'
      const overrideSource = isUserJob ? String(job?.dataset_name || '') : undefined
      const overrideWorkspace = isUserJob ? String(job?.workspace_id || '') : undefined

      for (let batchStart = 0; batchStart < chunkData.length; batchStart += MICRO_BATCH_SIZE) {
        const microBatchMap: Record<string, any> = {}
        const batchEnd = Math.min(batchStart + MICRO_BATCH_SIZE, chunkData.length)
        
        // Préparer le micro-batch
        for (let i = batchStart; i < batchEnd; i++) {
          const row = chunkData[i]
          if (!row || typeof row !== 'object') continue
          
          // Validation assouplie
          const nom = String(row['Nom'] || '').trim()
          const fe = String(row['FE'] || '').trim()
          const source = String((overrideSource ?? row['Source']) || '').trim()
          
          const hasBasicRequired = Boolean(nom && fe && source)
          const feNum = parseFloat(fe.replace(',', '.'))
          
          if (!hasBasicRequired || !Number.isFinite(feNum)) {
            if (processedCount < 3) console.log('❌ Ligne rejetée:', { nom, fe, source, feNum })
            continue
          }
          
          processedCount++
          const transformedRow = transformRow(row, job.language, overrideSource, overrideWorkspace)
          microBatchMap[transformedRow.factor_key] = {
            ...transformedRow,
            _job_id: job_id,
            _chunk_number: chunk_number
          }
        }
        const microBatch = Object.values(microBatchMap)
        
        // SCD2 : Invalider puis insérer (gère les doublons)
        if (microBatch.length > 0) {
          const { data: upCount, error: upErr } = await supabase.rpc('scd2_upsert_emission_factors', { p_records: microBatch as any }) as any
          if (upErr) throw new Error(`Insert failed: ${upErr.message}`)
          insertedCount += Number(upCount) || microBatch.length
          console.log(`✅ Micro-batch ${Math.floor(batchStart/MICRO_BATCH_SIZE) + 1}: ${Number(upCount) || microBatch.length} inserted (SCD2)`)
        }
      }
    } finally {
      if (triggersDisabled) { try { await supabase.rpc('enable_emission_factors_triggers') } catch (_) {}; try { await supabase.rpc('enable_emission_factors_all_search_triggers') } catch (_) {} }
      try { await supabase.rpc('release_chunk_lock', { p_job_id: job_id, p_chunk_number: chunk_number }) } catch (_) {}
    }

    // Marquer le chunk comme traité
    await supabase.from('import_chunks').update({ processed: true, records_count: processedCount, inserted_count: insertedCount, processed_at: new Date().toISOString(), error_message: null }).eq('id', chunk.id)

    // Mettre à jour le progrès du job (compatible avec data_imports)
    try {
      await supabase.rpc('update_job_progress', { p_job_id: job_id })
    } catch (e) {
      // Fallback: mettre à jour data_imports directement
      await supabase
        .from('data_imports')
        .update({
          processed: (job.processed || 0) + processedCount,
          inserted: (job.inserted || 0) + insertedCount
        })
        .eq('id', job_id)
    }

    // Progress info (sans reindex ici; géré côté DB cron finalize)
    const { data: updatedJob } = await supabase
      .from('import_jobs')
      .select('processed_chunks, total_chunks')
      .eq('id', job_id)
      .maybeSingle()
    console.log(`⏳ Job progress: ${updatedJob?.processed_chunks || 0}/${updatedJob?.total_chunks || 0} chunks`)

    console.log(`✅ Chunk ${chunk_number} processed: ${processedCount} records, ${insertedCount} inserted`)

    return new Response(JSON.stringify({ 
      success: true,
      job_id,
      chunk_number,
      processed: processedCount,
      inserted: insertedCount,
      job_completed: updatedJob?.status === 'completed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Chunk processing error:', error)
    
    // Marquer le chunk en erreur
    try {
      if (job_id && chunk_number !== undefined) {
        const supabaseError = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        await supabaseError
          .from('import_chunks')
          .update({ 
            error_message: formatError(error),
            processed_at: new Date().toISOString()
          })
          .eq('job_id', job_id)
          .eq('chunk_number', chunk_number)
      }
    } catch (e) {
      console.warn('Failed to update chunk error:', e)
    }
    
    return new Response(JSON.stringify({ error: formatError(error) }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
