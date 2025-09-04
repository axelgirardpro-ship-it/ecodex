// CREATE-CHUNKS: Génère tous les chunks pour un job et les envoie en queue
// @ts-ignore - Import ESM valide pour Deno/Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface DenoEnv { get(key: string): string | undefined }
interface DenoGlobal { env: DenoEnv; serve(h: (req: Request) => Promise<Response> | Response): void }
declare const Deno: DenoGlobal

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
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

    const body = await req.json().catch(() => ({}))
    const jobId: string | undefined = body?.job_id
    if (!jobId) {
      return new Response(JSON.stringify({ error: 'job_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: job, error: jobErr } = await supabase
      .from('import_jobs')
      .select('*')
      .eq('id', jobId)
      .single()
    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!job.file_path) {
      return new Response(JSON.stringify({ error: 'Job has no file_path' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Lire paramètre lines_per_chunk
    let linesPerChunk = 500
    try {
      const { data: setting } = await supabase
        .from('import_settings')
        .select('value')
        .eq('key', 'lines_per_chunk')
        .maybeSingle()
      if (setting?.value) {
        const v = Number(setting.value)
        if (Number.isFinite(v) && v > 0) linesPerChunk = v
      }
    } catch {}

    // Sign URL
    const { data: signed, error: signedErr } = await supabase
      .storage
      .from('imports')
      .createSignedUrl(job.file_path, 3600)
    if (signedErr || !signed?.signedUrl) {
      return new Response(JSON.stringify({ error: 'Cannot sign storage url' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const textStream = await openTextStream(signed.signedUrl)
    let headersRow: string[] | null = null
    let bufferRows: Record<string, string>[] = []
    let totalLines = 0
    let chunkCount = 0

    // Repartir sur le prochain numéro de chunk disponible
    let nextChunkNumber = 0
    try {
      const { data: lastChunk } = await supabase
        .from('import_chunks')
        .select('chunk_number')
        .eq('job_id', jobId)
        .order('chunk_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (lastChunk) nextChunkNumber = Number(lastChunk.chunk_number) + 1
    } catch {}

    async function flushChunk() {
      if (bufferRows.length === 0) return
      const myChunkNumber = nextChunkNumber++
      const { error: insErr } = await supabase.from('import_chunks').insert({
        job_id: jobId,
        chunk_number: myChunkNumber,
        data: bufferRows,
        records_count: bufferRows.length,
        processed: false
      })
      if (insErr) throw insErr
      // Enfiler le chunk dans PGMQ via RPC dédiée
      await supabase.rpc('enqueue_csv_chunk', { p_job_id: jobId, p_chunk_number: myChunkNumber })
      bufferRows = []
      chunkCount++
    }

    for await (const line of iterateLines(textStream)) {
      if (headersRow === null) {
        headersRow = parseCSVLine(line)
        continue
      }
      if (!line || line.trim() === '') continue
      totalLines++
      const values = parseCSVLine(line)
      if (headersRow && values.length === headersRow.length) {
        const row: Record<string, string> = {}
        headersRow.forEach((h, idx) => { row[h] = values[idx] || '' })
        bufferRows.push(row)
      }
      if (bufferRows.length >= linesPerChunk) {
        await flushChunk()
      }
    }
    await flushChunk()

    // Mettre à jour le job
    const totalChunks = nextChunkNumber
    await supabase.from('import_jobs').update({
      total_chunks: totalChunks,
      status: 'processing',
      progress_percent: 0
    }).eq('id', jobId)

    return new Response(JSON.stringify({
      ok: true,
      job_id: jobId,
      total_lines: totalLines,
      total_chunks: totalChunks,
      created_chunks: chunkCount
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})


