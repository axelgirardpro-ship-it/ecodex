// Deno Deploy / Supabase Edge Function
// Génération d'une clé de recherche Algolia sécurisée

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import algoliasearch from 'npm:algoliasearch';

const ALGOLIA_APP_ID = Deno.env.get('ALGOLIA_APP_ID') ?? '';
const ALGOLIA_ADMIN_KEY = Deno.env.get('ALGOLIA_ADMIN_KEY') ?? '';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'GET') {
      return jsonResponse(405, { error: 'Method not allowed' });
    }

    if (!ALGOLIA_APP_ID || !ALGOLIA_ADMIN_KEY) {
      return jsonResponse(500, { error: 'Algolia credentials not configured' });
    }

    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader || '' } },
    });

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }

    // Restrictions de la clé
    const validUntil = Math.floor(Date.now() / 1000) + 60 * 60; // 1h
    const restrictions = {
      restrictIndices: ['ef_public_fr', 'ef_private_fr'],
      validUntil,
      userToken: user.id,
    } as any;

    // Génération de la clé sécurisée
    // algoliasearch.generateSecuredApiKey(adminKey, restrictions)
    // @ts-ignore - la méthode est exposée par le package Node
    const securedKey = algoliasearch.generateSecuredApiKey(ALGOLIA_ADMIN_KEY, restrictions);

    return jsonResponse(200, {
      appId: ALGOLIA_APP_ID,
      searchApiKey: securedKey,
      validUntil,
    });
  } catch (e) {
    return jsonResponse(500, { error: 'Internal error', details: String(e) });
  }
});
