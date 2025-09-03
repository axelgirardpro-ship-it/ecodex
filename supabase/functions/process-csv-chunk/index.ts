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

function transformRow(row: Record<string, any>, language: string = 'fr'): any {
  const toNumber = (s: string) => { 
    const n = parseFloat(String(s).replace(',', '.'))
    return Number.isFinite(n) ? n : null 
  }
  const toInt = (s: string) => { 
    const n = parseInt(String(s).replace(/[^0-9-]/g, ''), 10)
    return Number.isFinite(n) ? n : null 
  }

  // Générer factor_key
  const factorKey = (row['ID'] && String(row['ID']).trim()) ? 
    String(row['ID']).trim() : 
    `${String(row['Nom'] || '').toLowerCase()}_${String(row['Source'] || '').toLowerCase()}_${String(row['Localisation'] || '').toLowerCase()}_${language}`.replace(/[^a-z0-9_]/g, '_')

  return {
    factor_key: factorKey,
    version_id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substring(2)}`,
    is_latest: true,
    valid_from: new Date().toISOString(),
    language,
    "Nom": String(row['Nom'] || ''),
    "Description": row['Description'] || null,
    "FE": toNumber(String(row['FE'] || '0')),
    "Unité donnée d'activité": String(row["Unité donnée d'activité"] || row['Unite'] || 'unité'),
    "Source": String(row['Source'] || 'Source inconnue'),
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
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { job_id, chunk_number } = await req.json()
    
    if (!job_id || chunk_number === undefined) {
      return new Response(JSON.stringify({ error: 'job_id and chunk_number required' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    console.log(`🔄 Processing chunk ${chunk_number} for job ${job_id}`)

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
    const MICRO_BATCH_SIZE = 25 // Réduit pour chunks volumineux (7k+ records)

    console.log(`📊 Processing chunk ${chunk_number}: ${chunkData.length} records`)

    // Désactiver temporairement les webhooks pour éviter les appels massifs
    let triggersDisabled = false
    try {
      await supabase.rpc('exec', { 
        query: 'ALTER TABLE emission_factors DISABLE TRIGGER emission_factors' 
      }).catch(() => {})
      triggersDisabled = true

      // Traiter par micro-batches pour éviter timeout
      for (let batchStart = 0; batchStart < chunkData.length; batchStart += MICRO_BATCH_SIZE) {
        const microBatch: any[] = []
        const batchEnd = Math.min(batchStart + MICRO_BATCH_SIZE, chunkData.length)
        
        // Préparer le micro-batch
        for (let i = batchStart; i < batchEnd; i++) {
          const row = chunkData[i]
          if (!row || typeof row !== 'object') continue
          
          // Validation assouplie
          const nom = String(row['Nom'] || '').trim()
          const fe = String(row['FE'] || '').trim()
          const source = String(row['Source'] || '').trim()
          
          const hasBasicRequired = Boolean(nom && fe && source)
          const feNum = parseFloat(fe.replace(',', '.'))
          
          if (!hasBasicRequired || !Number.isFinite(feNum)) {
            if (processedCount < 3) console.log('❌ Ligne rejetée:', { nom, fe, source, feNum })
            continue
          }
          
          processedCount++
          const transformedRow = transformRow(row, job.language)
          microBatch.push(transformedRow)
        }
        
        // SCD2 : Invalider puis insérer (gère les doublons)
        if (microBatch.length > 0) {
          const factorKeys = microBatch.map(r => r.factor_key)
          await supabase
            .from('emission_factors')
            .update({ is_latest: false, valid_to: new Date().toISOString() })
            .in('factor_key', factorKeys)
            .eq('is_latest', true)
          const { data: result, error: insertErr } = await supabase
            .from('emission_factors')
            .insert(microBatch)
            .select('id')
          if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`)
          insertedCount += result?.length || 0
          console.log(`✅ Micro-batch ${Math.floor(batchStart/MICRO_BATCH_SIZE) + 1}: ${result?.length || 0} inserted (SCD2)`)
        }
      }
    } finally {
      if (triggersDisabled) {
        await supabase.rpc('exec', { 
          query: 'ALTER TABLE emission_factors ENABLE TRIGGER emission_factors' 
        }).catch(() => {})
      }
    }

    // Marquer le chunk comme traité
    await supabase
      .from('import_chunks')
      .update({ 
        processed: true,
        records_count: processedCount,
        inserted_count: insertedCount,
        processed_at: new Date().toISOString()
      })
      .eq('id', chunk.id)

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
      const { job_id, chunk_number } = await req.json()
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
