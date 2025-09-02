// DEBUG CSV: Analyser headers et premières lignes
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

    const { file_path } = await req.json()
    if (!file_path) {
      return new Response(JSON.stringify({ error: 'file_path required' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Lire le fichier
    const { data: signed, error: signedErr } = await supabase.storage
      .from('imports')
      .createSignedUrl(file_path, 3600)
    if (signedErr || !signed?.signedUrl) throw new Error('Cannot sign storage url')

    const res = await fetch(signed.signedUrl)
    if (!res.ok) throw new Error('Cannot fetch file')
    
    let content: string
    if (file_path.toLowerCase().includes('.gz')) {
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

    const headers = parseCSVLine(lines[0])
    const samples = lines.slice(1, 4).map(line => {
      const values = parseCSVLine(line)
      const row: Record<string,string> = {}
      headers.forEach((h, idx) => { row[h] = values[idx] || '' })
      return {
        raw_values: values.slice(0, 10),
        mapped_row: Object.fromEntries(Object.entries(row).slice(0, 10))
      }
    })

    // Validation debug
    const required = ['Nom', 'FE', "Unité donnée d'activité", 'Source', 'Périmètre', 'Localisation', 'Date']
    const missing = required.filter(col => !headers.includes(col))

    return new Response(JSON.stringify({ 
      file_path,
      total_lines: lines.length,
      headers: headers,
      missing_required: missing,
      samples: samples,
      validation_check: samples.map(s => {
        const row = s.mapped_row
        return {
          has_nom: !!row['Nom'],
          has_fe: !!row['FE'],
          has_unite: !!row["Unité donnée d'activité"],
          has_source: !!row['Source'],
          has_perimetre: !!row['Périmètre'],
          has_localisation: !!row['Localisation'],
          has_date: !!row['Date'],
          fe_numeric: parseFloat(String(row['FE']).replace(',', '.'))
        }
      })
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
