// PROCESS CSV CHUNK: Edge Function spécialisée pour traiter un chunk
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

    // Récupérer le chunk et le job
    const { data: chunk, error: chunkErr } = await supabase
      .from('import_chunks')
      .select('*')
      .eq('job_id', job_id)
      .eq('chunk_number', chunk_number)
      .eq('processed', false)
      .single()
    
    if (chunkErr || !chunk) {
      return new Response(JSON.stringify({ error: 'Chunk not found or already processed' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const { data: job, error: jobErr } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', job_id)
      .single()
    
    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), { 
        status: 404, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const chunkData = Array.isArray(chunk.data) ? chunk.data : []
    let processedCount = 0
    let insertedCount = 0
    const MICRO_BATCH_SIZE = 50 // Très petits batches pour éviter timeout

    console.log(`📊 Processing chunk ${chunk_number}: ${chunkData.length} records`)

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
          // Debug: log les premières rejections
          if (processedCount < 3) {
            console.log('❌ Ligne rejetée:', { nom, fe, source, feNum })
          }
          continue
        }
        
        processedCount++
        const transformedRow = transformRow(row, job.language)
        microBatch.push(transformedRow)
      }

      // Insert du micro-batch
      if (microBatch.length > 0) {
        const { data: result, error: insertErr } = await supabase
          .from('emission_factors')
          .insert(microBatch)
          .select('id')
        
        if (insertErr) {
          console.error(`❌ Micro-batch insert failed:`, insertErr.message)
          throw new Error(`Insert failed: ${insertErr.message}`)
        }
        
        insertedCount += result?.length || 0
        console.log(`✅ Micro-batch ${Math.floor(batchStart/MICRO_BATCH_SIZE) + 1}: ${result?.length || 0} inserted`)
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

    // Mettre à jour le progrès du job
    await supabase.rpc('update_job_progress', { p_job_id: job_id })

    // Vérifier si le job est terminé pour déclencher Algolia
    const { data: updatedJob } = await supabase
      .from('import_jobs')
      .select('status, processed_chunks, total_chunks, replace_all, inserted_records')
      .eq('id', job_id)
      .single()

    if (updatedJob?.status === 'completed' && updatedJob.replace_all && updatedJob.inserted_records > 0) {
      // Déclencher reindex Algolia
      try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
        const algoliaResp = await fetch(`${SUPABASE_URL}/functions/v1/reindex-ef-all-atomic`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        })
        
        const algoliaResult = await algoliaResp.text()
        
        await supabase.from('audit_logs').insert({
          user_id: job.user_id,
          action: 'algolia_reindex_triggered_chunked',
          details: { 
            job_id, 
            status: algoliaResp.status, 
            response: algoliaResult,
            total_records: updatedJob.inserted_records
          }
        })
        
        console.log(`🔍 Algolia reindex triggered for job ${job_id}`)
      } catch (e) {
        console.warn('Algolia reindex failed:', e)
      }
    }

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
        await supabase
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
