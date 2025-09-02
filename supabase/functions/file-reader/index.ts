// FILE READER: Edge Function minimale pour lire fichiers et stocker contenu
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { job_id } = await req.json()
    if (!job_id) {
      return new Response(JSON.stringify({ error: 'job_id required' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Récupérer le job
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

    // Lire le fichier depuis Storage
    const { data: signed, error: signedErr } = await supabase.storage
      .from('imports')
      .createSignedUrl(job.file_path, 3600)
    
    if (signedErr || !signed?.signedUrl) {
      throw new Error(`Cannot sign storage url: ${signedErr?.message}`)
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

    // Stocker le contenu dans une table temporaire pour le worker SQL
    const { error: storeErr } = await supabase
      .from('import_file_cache')
      .upsert({
        job_id: job_id,
        file_content: content,
        created_at: new Date().toISOString()
      })
    
    if (storeErr) {
      // Fallback: stocker dans error_details du job
      await supabase
        .from('import_jobs')
        .update({
          error_details: { 
            file_content: content.substring(0, 100000), // Limiter la taille
            content_length: content.length 
          }
        })
        .eq('id', job_id)
    }

    // Marquer comme prêt pour traitement SQL
    await supabase
      .from('import_jobs')
      .update({
        status: 'ready_for_processing',
        progress_percent: 15
      })
      .eq('id', job_id)

    return new Response(JSON.stringify({ 
      ok: true, 
      job_id,
      content_length: content.length,
      lines_count: content.split('\n').length
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
