import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed' })

  try {
    const url = new URL(req.url)
    const q = url.searchParams.get('q') || ''
    const source = url.searchParams.get('source') || undefined
    const limit = Math.min(Number(url.searchParams.get('limit') || 20), 100)

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    let query = supabase
      .from('emission_factors_teaser_public_fr')
      .select('*')
      .limit(limit)

    if (source) query = query.eq('Source', source)
    if (q) {
      // Filtre simple côté DB: il est recommandé d'utiliser Algolia via l'edge proxy pour le search plein-texte
      query = query.ilike('Nom', `%${q}%`)
    }

    const { data, error } = await query
    if (error) return json(500, { error: error.message })
    return json(200, { items: data })
  } catch (e) {
    return json(500, { error: String(e) })
  }
})


