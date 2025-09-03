// IMPORT PROCESSOR: Worker dédié pour traiter les jobs depuis import_jobs table
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

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]
    if (char === '"') {
      if (inQuotes && nextChar === '"') { current += '"'; i++ } 
      else { inQuotes = !inQuotes }
    } else if (char === ',' && !inQuotes) { 
      result.push(current.trim()); current = '' 
    } else { 
      current += char 
    }
  }
  result.push(current.trim())
  return result
}

async function processJob(jobId: string, supabase: any) {
  // Récupérer le job
  const { data: job, error: jobErr } = await supabase
    .from('import_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('status', 'queued')
    .single()
    
  if (jobErr || !job) return 'Job not found or already processed'

  // Marquer comme processing
  await supabase.from('import_jobs').update({
    status: 'processing',
    started_at: new Date().toISOString(),
    progress_percent: 5
  }).eq('id', jobId)

  try {
    // Lire le fichier depuis Storage
    console.log('📁 Tentative lecture fichier:', job.file_path)
    const { data: signed, error: signedErr } = await supabase.storage
      .from('imports')
      .createSignedUrl(job.file_path, 3600)
    
    console.log('🔗 Signed URL result:', { error: signedErr, hasUrl: !!signed?.signedUrl })
    if (signedErr) {
      console.error('❌ Storage error:', signedErr)
      throw new Error(`Storage error: ${signedErr.message}`)
    }
    if (!signed?.signedUrl) {
      throw new Error('No signed URL returned')
    }

    const res = await fetch(signed.signedUrl)
    if (!res.ok) throw new Error('Cannot fetch file')
    
    let content: string
    if (job.file_path.toLowerCase().includes('.gz')) {
      // @ts-ignore
      const decompressed = res.body.pipeThrough(new DecompressionStream('gzip'))
      const reader = decompressed.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let { value, done } = await reader.read()
      while (!done) {
        if (value) buffer += decoder.decode(value, { stream: true })
        ;({ value, done } = await reader.read())
      }
      content = buffer
    } else {
      content = await res.text()
    }

    const lines = content.split(/\r?\n/).filter(l => l.trim() !== '')
    if (lines.length === 0) throw new Error('Empty file')

    const headers = parseCSVLine(lines[0])
    
    await supabase.from('import_jobs').update({ 
      progress_percent: 10,
      total_lines: lines.length - 1
    }).eq('id', jobId)

    // Replace all: vider la table
    if (job.replace_all) {
      await supabase.from('emission_factors').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('import_jobs').update({ progress_percent: 15 }).eq('id', jobId)
    }

    let processed = 0
    let inserted = 0
    const batchSize = 100
    let batch: any[] = []

    const toNumber = (s: string) => { 
      const n = parseFloat(String(s).replace(',', '.'))
      return Number.isFinite(n) ? n : null 
    }
    const toInt = (s: string) => { 
      const n = parseInt(String(s).replace(/[^0-9-]/g, ''), 10)
      return Number.isFinite(n) ? n : null 
    }

    // Traitement par batches
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i])
      if (values.length !== headers.length) continue
      
      const row: Record<string,string> = {}
      headers.forEach((h, idx) => { row[h] = values[idx] || '' })
      
      // Validation stricte
      const hasRequired = Boolean(
        row['Nom'] && row['FE'] && row["Unité donnée d'activité"] && 
        row['Source'] && row['Périmètre'] && row['Localisation'] && row['Date']
      )
      const feNum = toNumber(row['FE'])
      if (!hasRequired || feNum === null) continue
      
      processed++
      const factorKey = (row['ID'] && row['ID'].trim()) ? 
        row['ID'].trim() : 
        `${row['Nom']}_${row['Source']}_${row['Localisation']}_${job.language}`.toLowerCase()

      batch.push({
        factor_key: factorKey,
        version_id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substring(2)}`,
        is_latest: true,
        valid_from: new Date().toISOString(),
        language: job.language,
        "Nom": row['Nom'],
        "Description": row['Description'] || null,
        "FE": feNum,
        "Unité donnée d'activité": row["Unité donnée d'activité"],
        "Source": row['Source'],
        "Secteur": row['Secteur'] || 'Non spécifié',
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
      })

      // Flush batch
      if (batch.length >= batchSize || i === lines.length - 1) {
        if (batch.length > 0) {
          const { data: result, error: insertErr } = await supabase
            .from('emission_factors')
            .insert(batch)
            .select('id')
          if (insertErr) throw insertErr
          inserted += result?.length || 0
          batch = []
        }

        // Mise à jour du progrès
        const progress = 15 + Math.round((i / lines.length) * 70)
        await supabase.from('import_jobs').update({ 
          progress_percent: progress,
          processed,
          inserted,
          current_line: i
        }).eq('id', jobId)
      }
    }

    // Algolia reindex pour supra-admin
    if (job.replace_all && inserted > 0) {
      await supabase.from('import_jobs').update({ progress_percent: 90 }).eq('id', jobId)
      
      try {
        const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
        const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const resp = await fetch(`${SUPABASE_URL}/functions/v1/reindex-ef-all-atomic`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_KEY}`
          },
          body: JSON.stringify({})
        })
        const algoliaResult = await resp.text()
        
        await supabase.from('audit_logs').insert({
          user_id: job.user_id,
          action: 'algolia_reindex_triggered',
          details: { job_id: jobId, status: resp.status, response: algoliaResult }
        })
      } catch (e) {
        console.warn('Algolia reindex failed:', e)
      }
    }

    // Finaliser
    await supabase.from('import_jobs').update({
      status: 'completed',
      progress_percent: 100,
      processed,
      inserted,
      finished_at: new Date().toISOString()
    }).eq('id', jobId)

    return `Completed: ${processed} processed, ${inserted} inserted`

  } catch (error) {
    await supabase.from('import_jobs').update({
      status: 'failed',
      error_details: { error: String(error) },
      finished_at: new Date().toISOString()
    }).eq('id', jobId)
    
    return `Failed: ${error}`
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Récupérer le prochain job à traiter
    const { data: job } = await supabase
      .from('import_jobs')
      .select('id')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (!job) {
      return new Response(JSON.stringify({ ok: true, message: 'No jobs in queue' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Traiter le job (asynchrone)
    const result = await processJob(job.id, supabase)

    return new Response(JSON.stringify({ 
      ok: true, 
      job_id: job.id,
      result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
