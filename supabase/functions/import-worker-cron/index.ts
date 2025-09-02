// IMPORT WORKER CRON: Traite les imports par tranches avec checkpoints
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Récupérer le prochain job à traiter
    const { data: job, error: jobErr } = await supabase
      .from('import_jobs')
      .select('*')
      .in('status', ['queued', 'processing'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (jobErr || !job) {
      return new Response(JSON.stringify({ ok: true, message: 'No jobs to process' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Marquer comme processing si queued
    if (job.status === 'queued') {
      await supabase.from('import_jobs').update({
        status: 'processing',
        started_at: new Date().toISOString(),
        current_line: 0
      }).eq('id', job.id)
    }

    // Lire le fichier
    const { data: signed, error: signedErr } = await supabase.storage
      .from('imports')
      .createSignedUrl(job.file_path, 3600)
    if (signedErr || !signed?.signedUrl) throw new Error('Cannot sign storage url')

    const res = await fetch(signed.signedUrl)
    if (!res.ok) throw new Error('Cannot fetch file')
    
    let content: string
    if (job.file_path.toLowerCase().includes('.gz')) {
      // Décompression pour fichiers .gz
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
    
    if (lines.length === 0) throw new Error('Fichier vide')

    // Mettre à jour total_lines si pas encore fait
    if (!job.total_lines) {
      await supabase.from('import_jobs').update({ 
        total_lines: lines.length - 1 // -1 pour header
      }).eq('id', job.id)
    }

    const headers = parseCSVLine(lines[0])
    const startLine = job.current_line || 1 // Reprendre où on s'était arrêté
    const endLine = Math.min(startLine + 100, lines.length) // Traiter 100 lignes max par appel
    
    let processed = job.processed || 0
    let inserted = job.inserted || 0
    const batch: any[] = []

    const toNumber = (s: string) => { const n = parseFloat(String(s).replace(',', '.')); return Number.isFinite(n) ? n : null }
    const toInt = (s: string) => { const n = parseInt(String(s).replace(/[^0-9-]/g, ''), 10); return Number.isFinite(n) ? n : null }

    // Vider la table au premier passage
    if (startLine === 1 && job.replace_all) {
      await supabase.from('emission_factors').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    }

    // Traiter la tranche
    for (let i = startLine; i < endLine; i++) {
      const values = parseCSVLine(lines[i])
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

    // Insert du batch
    if (batch.length > 0) {
      const { data: result, error: insertErr } = await supabase
        .from('emission_factors')
        .insert(batch)
        .select('id')
      if (insertErr) throw insertErr
      inserted += result?.length || 0
    }

    // Sauvegarder le checkpoint
    const isComplete = endLine >= lines.length
    const progress = Math.round((endLine / lines.length) * 100)

    await supabase.from('import_jobs').update({
      current_line: endLine,
      progress_percent: progress,
      processed,
      inserted,
      last_checkpoint: new Date().toISOString(),
      status: isComplete ? 'completed' : 'processing',
      finished_at: isComplete ? new Date().toISOString() : null
    }).eq('id', job.id)

    return new Response(JSON.stringify({ 
      ok: true, 
      job_id: job.id,
      progress: progress,
      processed,
      inserted,
      complete: isComplete,
      lines_processed: endLine - startLine
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Worker cron error:', error)
    return new Response(JSON.stringify({ error: String(error) }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
