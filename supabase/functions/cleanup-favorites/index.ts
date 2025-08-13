import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' })

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return json(500, { error: 'Supabase environment not configured' })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Only supra-admin allowed
    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!authHeader) return json(401, { error: 'Missing bearer token' })
    const { data: userRes, error: userErr } = await supabase.auth.getUser(authHeader)
    if (userErr || !userRes?.user) return json(401, { error: 'Unauthorized' })
    const { data: isSupra, error: roleErr } = await supabase.rpc('is_supra_admin', { user_uuid: userRes.user.id })
    if (roleErr) return json(500, { error: 'Authorization check failed' })
    if (!isSupra) return json(403, { error: 'Access denied' })

    const { error } = await supabase
      .from('favorites')
      .delete()
      .neq('user_id', '') // force delete all rows

    if (error) return json(500, { error: error.message })
    return json(200, { ok: true, message: 'All favorites cleared' })
  } catch (e) {
    return json(500, { error: String(e) })
  }
})


