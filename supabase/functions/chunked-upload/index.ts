// CHUNKED UPLOAD: Edge Function pour gérer l'upload chunké
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

    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const { storage_path, filename, replace_all, file_size } = await req.json()
    
    if (!storage_path || !filename) {
      return new Response(JSON.stringify({ error: 'storage_path and filename required' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Lire le fichier depuis Storage
    const { data: signed, error: signedErr } = await supabase.storage
      .from('imports')
      .createSignedUrl(storage_path, 3600)
    
    if (signedErr || !signed?.signedUrl) {
      throw new Error(`Cannot sign storage url: ${signedErr?.message}`)
    }

    const res = await fetch(signed.signedUrl)
    if (!res.ok) throw new Error('Cannot fetch file')
    
    let csvContent: string
    if (storage_path.toLowerCase().includes('.gz')) {
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
      csvContent = buffer
    } else {
      csvContent = await res.text()
    }

    // Approche streaming pour éviter WORKER_LIMIT sur gros fichiers
    const lines = csvContent.split(/\r?\n/)
    if (lines.length < 2) {
      return new Response(JSON.stringify({ error: 'File appears empty' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    const headers = parseCSVLine(lines[0])
    const LINES_PER_CHUNK = 1000 // Réduire pour éviter WORKER_LIMIT
    const totalLines = lines.length - 1
    const totalChunks = Math.ceil(totalLines / LINES_PER_CHUNK)

    // Créer le job d'import
    const { data: job, error: jobErr } = await supabase
      .from('import_jobs')
      .insert({
        user_id: user.id,
        filename,
        original_size: file_size || csvContent.length,
        total_chunks: totalChunks,
        replace_all: replace_all ?? true,
        language: 'fr',
        status: 'pending'
      })
      .select()
      .single()

    if (jobErr) throw jobErr

    // Traitement par petits chunks pour éviter timeout
    let chunksCreated = 0
    const maxChunksPerCall = 5 // Limiter à 5 chunks par appel Edge Function
    
    for (let i = 0; i < Math.min(totalChunks, maxChunksPerCall); i++) {
      const startLine = i * LINES_PER_CHUNK + 1 // +1 pour skip headers
      const endLine = Math.min(startLine + LINES_PER_CHUNK, lines.length)
      const chunkLines = lines.slice(startLine, endLine)

      const parsedData: any[] = []
      
      chunkLines.forEach(line => {
        if (!line || line.trim() === '') return
        const values = parseCSVLine(line)
        if (values.length === headers.length) {
          const row: Record<string, string> = {}
          headers.forEach((h, idx) => { row[h] = values[idx] || '' })
          parsedData.push(row)
        }
      })

      if (parsedData.length > 0) {
        // Stocker le chunk
        const { error: chunkErr } = await supabase
          .from('import_chunks')
          .insert({
            job_id: job.id,
            chunk_number: i,
            data: parsedData,
            records_count: parsedData.length
          })

        if (!chunkErr) {
          // Envoyer dans la queue
          await supabase.rpc('pgmq.send', {
            queue_name: 'csv_import_queue',
            msg: {
              job_id: job.id,
              chunk_number: i,
              timestamp: new Date().toISOString()
            }
          })
          chunksCreated++
        }
      }
    }
    
    // Pour les gros fichiers, programmer les chunks restants
    if (totalChunks > maxChunksPerCall) {
      // Marquer pour traitement différé par le cron
      await supabase.from('import_jobs').update({
        status: 'pending_chunks_creation',
        progress_percent: Math.round((chunksCreated / totalChunks) * 100)
      }).eq('id', job.id)
    }

    return new Response(JSON.stringify({ 
      success: true,
      job_id: job.id,
      total_lines: dataLines.length,
      total_chunks: totalChunks,
      chunks_created: chunksCreated,
      message: `Import job créé avec ${chunksCreated} chunks. Traitement automatique en cours.`
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
