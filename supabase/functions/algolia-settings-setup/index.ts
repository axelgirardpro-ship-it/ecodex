// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!authHeader) return json(401, { error: 'Missing bearer token' })
    const { data: userRes, error: userErr } = await supabase.auth.getUser(authHeader)
    if (userErr || !userRes?.user) return json(401, { error: 'Unauthorized' })

    const { data: isSupra, error: roleErr } = await supabase.rpc('is_supra_admin', { user_uuid: userRes.user.id })
    if (roleErr || !isSupra) return json(403, { error: 'Access denied - supra admin required' })

    // Créer le bucket s'il n'existe pas, sinon fallback sur bucket existant 'source-logos'
    const primaryBucket = 'algolia_settings'
    // @ts-ignore - types de supabase-js
    const { data: buckets } = await supabase.storage.listBuckets()
    const exists = (buckets || []).some((b: any) => b.name === primaryBucket)
    if (!exists) {
      // @ts-ignore - types de supabase-js
      const { error: createErr } = await supabase.storage.createBucket(primaryBucket, {
        public: false,
        fileSizeLimit: 1024 * 1024, // 1MB
        allowedMimeTypes: ['application/json'],
      })
      if (createErr) {
        // Fallback: nothing to create, we will rely on source-logos
        return json(200, { ok: true, bucket: 'source-logos', created: false, fallback: true })
      }
    }

    return json(200, { ok: true, bucket: primaryBucket, created: !exists })
  } catch (e) {
    return json(500, { error: String(e) })
  }
})


