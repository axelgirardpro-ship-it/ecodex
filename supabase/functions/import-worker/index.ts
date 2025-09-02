// IMPORT WORKER: Traite les jobs d'import en arrière-plan (gros volumes)
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

// Parsing CSV simple et robuste
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

async function processImportJob(jobId: string, supabase: any) {
  // Récupérer le job
  const { data: job, error: jobErr } = await supabase
    .from('import_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('status', 'queued')
    .single()
    
  if (jobErr || !job) {
    console.log('Job non trouvé ou déjà traité:', jobId)
    return
  }

  // Marquer comme en cours
  await supabase.from('import_jobs').update({
    status: 'processing',
    started_at: new Date().toISOString(),
    progress_percent: 0
  }).eq('id', jobId)

  try {
    // 1. Vider la table si replace_all
    if (job.replace_all) {
      await supabase.from('emission_factors').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('import_jobs').update({ progress_percent: 5 }).eq('id', jobId)
    }

    // 2. Lire le fichier depuis Storage
    const { data: signed, error: signedErr } = await supabase.storage
      .from('imports')
      .createSignedUrl(job.file_path, 3600)
    if (signedErr || !signed?.signedUrl) throw new Error('Cannot sign storage url')

    const res = await fetch(signed.signedUrl)
    if (!res.ok) throw new Error('Cannot fetch file')
    
    let content = await res.text()
    
    // 3. Décompression si .gz
    if (job.file_path.toLowerCase().includes('.gz')) {
      // Pour les fichiers .gz, on assume qu'ils sont déjà décompressés par le fetch
      // ou on utilise une approche différente
    }

    // 4. Parser CSV ligne par ligne
    const lines = content.split(/\r?\n/).filter(l => l.trim() !== '')
    if (lines.length === 0) throw new Error('Fichier vide')

    const headers = parseCSVLine(lines[0])
    const toNumber = (s: string) => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) ? n : null }
    const toInt = (s: string) => { const n = parseInt(String(s).replace(/[^0-9-]/g, ''), 10); return Number.isFinite(n) ? n : null }

    let processed = 0
    let inserted = 0
    const batchSize = 50 // Très petit pour éviter timeout

    await supabase.from('import_jobs').update({ progress_percent: 10 }).eq('id', jobId)

    // 5. Traitement par micro-batches
    for (let i = 1; i < lines.length; i += batchSize) {
      const batch: any[] = []
      
      for (let j = i; j < Math.min(i + batchSize, lines.length); j++) {
        const values = parseCSVLine(lines[j])
        if (values.length !== headers.length) continue
        
        const row: Record<string,string> = {}
        headers.forEach((h, idx) => { row[h] = values[idx] || '' })
        
        // Validation
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
      }

      if (batch.length > 0) {
        const { data: result, error: insertErr } = await supabase
          .from('emission_factors')
          .insert(batch)
          .select('id')
        if (insertErr) throw insertErr
        inserted += result?.length || 0
      }

      // Mise à jour du progrès
      const progress = Math.round((i / lines.length) * 80) + 10 // 10-90%
      await supabase.from('import_jobs').update({ 
        progress_percent: progress,
        processed,
        inserted 
      }).eq('id', jobId)
    }

    // 6. Finaliser
    await supabase.from('import_jobs').update({
      status: 'completed',
      progress_percent: 100,
      processed,
      inserted,
      finished_at: new Date().toISOString()
    }).eq('id', jobId)

    console.log(`✅ Job ${jobId} terminé: ${processed} traités, ${inserted} insérés`)

  } catch (error) {
    console.error('❌ Job failed:', error)
    await supabase.from('import_jobs').update({
      status: 'failed',
      error_details: { error: formatError(error) },
      finished_at: new Date().toISOString()
    }).eq('id', jobId)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (req.method === 'POST') {
      // Déclencher le traitement d'un job spécifique
      const { job_id } = await req.json()
      if (!job_id) {
        return new Response(JSON.stringify({ error: 'job_id required' }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }
      
      // Traitement asynchrone (ne pas attendre)
      processImportJob(job_id, supabase).catch(console.error)
      
      return new Response(JSON.stringify({ ok: true, message: 'Job started' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // GET: Récupérer le prochain job en queue
    const { data: nextJob } = await supabase
      .from('import_jobs')
      .select('id')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (nextJob) {
      processImportJob(nextJob.id, supabase).catch(console.error)
      return new Response(JSON.stringify({ ok: true, job_id: nextJob.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ ok: true, message: 'No jobs in queue' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: formatError(error) }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
