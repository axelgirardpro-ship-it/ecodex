// Deno Deploy / Supabase Edge Function
// Génération d'une clé de recherche Algolia sécurisée

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateSecuredApiKey } from 'https://esm.sh/algoliasearch@5?target=deno';

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

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspaceId') || '';

    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader || '' } },
    });

    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return jsonResponse(401, { error: 'Unauthorized' });
    }

    // Restrictions des clés (1h)
    const validUntil = Math.floor(Date.now() / 1000) + 60 * 60;

    // Clés unifiées pour l'index unique ef_all
    // 1) PUBLIC FULL: scope public, standard ou premium assigné au workspace
    const filtersPublicFull = workspaceId
      ? `(scope:public) AND ((access_level:standard) OR (assigned_workspace_ids:${workspaceId}))`
      : `(scope:public) AND (access_level:standard)`;

    // 2) PRIVATE FULL: scope privé du workspace courant
    const filtersPrivateFull = workspaceId
      ? `(scope:private) AND (workspace_id:${workspaceId})`
      : `(scope:private) AND (workspace_id:_none_)`;

    // 3) PUBLIC TEASER: scope public premium non assigné (paywall)
    const filtersPublicTeaser = workspaceId
      ? `(scope:public) AND (access_level:premium)`
      : `(scope:public) AND (access_level:premium)`;

    // Attributs non sensibles autorisés pour la clé TEASER
    const teaserAttrs = [
      'objectID', 'scope', 'languages', 'access_level', 'Source', 'Date',
      'Nom_fr','Secteur_fr','Sous-secteur_fr','Localisation_fr','Périmètre_fr',
      'Nom_en','Secteur_en','Sous-secteur_en','Localisation_en','Périmètre_en'
    ];

    const baseRestrictions = { restrictIndices: ['ef_all'], validUntil, userToken: user.id } as any;

    const searchApiKeyPublicFull = generateSecuredApiKey(ALGOLIA_ADMIN_KEY, {
      ...baseRestrictions,
      filters: filtersPublicFull,
      attributesToRetrieve: ['*'],
    });
    const searchApiKeyPrivateFull = generateSecuredApiKey(ALGOLIA_ADMIN_KEY, {
      ...baseRestrictions,
      filters: filtersPrivateFull,
      attributesToRetrieve: ['*'],
    });
    const searchApiKeyPublicTeaser = generateSecuredApiKey(ALGOLIA_ADMIN_KEY, {
      ...baseRestrictions,
      filters: filtersPublicTeaser,
      attributesToRetrieve: teaserAttrs,
    });

    return jsonResponse(200, {
      appId: ALGOLIA_APP_ID,
      validUntil,
      fullPublic: { searchApiKey: searchApiKeyPublicFull, filters: filtersPublicFull },
      fullPrivate: { searchApiKey: searchApiKeyPrivateFull, filters: filtersPrivateFull },
      teaserPublic: { searchApiKey: searchApiKeyPublicTeaser, filters: filtersPublicTeaser },
    });
  } catch (e) {
    return jsonResponse(500, { error: 'Internal error', details: String(e) });
  }
});
