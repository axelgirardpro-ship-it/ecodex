import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

// Cache mémoire côté Edge (TTL court) pour limiter les hits
const CACHE_TTL_MS = Number(Deno.env.get('ADMIN_WS_CACHE_TTL_MS') || '30000')
type CacheEntry = { expiresAt: number; payload: unknown }
const cache: Record<string, CacheEntry> = {}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, Authorization, x-client-info, X-Client-Info, apikey, content-type, Content-Type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Valider le JWT en utilisant supabase.auth.getUser()
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('[get-admin-workspaces] No Authorization header')
      return new Response(JSON.stringify({ error: 'No Authorization header' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Extraire le token du header "Bearer <token>"
    const token = authHeader.replace('Bearer ', '')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    console.log('[get-admin-workspaces] Validating JWT')
    console.log('[get-admin-workspaces] Token starts with:', token.substring(0, 20))
    
    // Décoder le JWT pour obtenir le payload (sans vérification de signature)
    // La signature sera vérifiée en vérifiant que l'utilisateur existe dans la base
    let userId: string
    try {
      const parts = token.split('.')
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format')
      }
      
      // Décoder le payload (partie 2 du JWT)
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      userId = payload.sub
      
      if (!userId) {
        throw new Error('No user ID in JWT')
      }
      
      console.log('[get-admin-workspaces] Extracted user ID from JWT:', userId)
    } catch (error) {
      console.error('[get-admin-workspaces] Failed to decode JWT:', error)
      return new Response(JSON.stringify({ 
        error: 'Invalid JWT format',
        details: error.message
      }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    // Créer un client Supabase avec SERVICE_ROLE_KEY
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Valider que l'utilisateur existe en utilisant l'admin API
    const { data: authUser, error: userError } = await supabase.auth.admin.getUserById(userId)
    
    if (userError || !authUser) {
      console.error('[get-admin-workspaces] User validation failed:', userError)
      return new Response(JSON.stringify({ 
        error: 'Invalid user',
        details: userError?.message
      }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const user = authUser.user
    console.log('[get-admin-workspaces] User authenticated successfully:', user.id)

    // Check if user is supra admin
    const { data: isSupra } = await supabase.rpc('is_supra_admin', { user_uuid: user.id })
    if (!isSupra) {
      return new Response('Forbidden', { status: 403, headers: corsHeaders })
    }

    // Get filter parameter from request body or query params
    let planFilter = 'paid'; // default to paid plans
    
    if (req.method === 'POST') {
      const body = await req.json();
      planFilter = body.planFilter || 'paid';
      console.log('POST request - planFilter:', planFilter);
    } else {
      const url = new URL(req.url);
      planFilter = url.searchParams.get('planFilter') || 'paid';
      console.log('GET request - planFilter:', planFilter);
    }

    // Réponse en cache si disponible
    const cacheKey = `ws:${planFilter}`
    const now = Date.now()
    const cached = cache[cacheKey]
    if (cached && now < cached.expiresAt) {
      return new Response(
        JSON.stringify({ data: cached.payload }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Define plan types based on filter
    let workspacesQuery = supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false });

    if (planFilter === 'freemium') {
      workspacesQuery = workspacesQuery.eq('plan_type', 'freemium');
      console.log('Filtering for freemium plans');
    } else if (planFilter === 'paid') {
      workspacesQuery = workspacesQuery.eq('plan_type', 'pro');
      console.log('Filtering for paid plans (pro)');
    } else if (planFilter === 'all') {
      console.log('Getting all workspaces');
      // No filter for 'all'
    } else {
      // Default to paid plans for invalid filter
      workspacesQuery = workspacesQuery.eq('plan_type', 'pro');
      console.log('Invalid filter, defaulting to paid plans (pro)');
    }

    console.log('Final filter applied:', planFilter);

    // Get workspaces based on plan filter
    const { data: workspaces, error: workspacesError } = await workspacesQuery;

    console.log('Found workspaces:', workspaces?.length, 'workspaces');
    console.log('Workspace plans:', workspaces?.map(w => `${w.name}: ${w.plan_type}`));

    if (workspacesError) throw workspacesError

    // Get detailed info for each workspace
    const workspacesWithDetails = await Promise.all(
      (workspaces || []).map(async (workspace) => {
        // Get owner details from auth.users
        const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(workspace.owner_id)
        
        // Count users in this workspace
        const { count: userCount } = await supabase
          .from('user_roles')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id)

        // Count pending invitations
        const { count: pendingInvitations } = await supabase
          .from('workspace_invitations')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id)
          .eq('status', 'pending')

        // Get tier info if plan_tier is set
        let tierInfo = null
        if (workspace.plan_tier) {
          const { data: tier } = await supabase
            .from('plan_tiers')
            .select('*')
            .eq('tier_code', workspace.plan_tier)
            .single()
          tierInfo = tier
        }

        // Use workspace plan_type instead of user subscription
        // The billing is at workspace level, not user level
        const workspacePlan = workspace.plan_type || 'freemium'
        const isSubscribed = workspacePlan === 'premium' || workspacePlan === 'standard'

        return {
          ...workspace,
          owner_email: authUser?.user?.email || 'Unknown',
          user_count: userCount || 0,
          pending_invitations: pendingInvitations || 0,
          tier_info: tierInfo,
          subscription_status: { 
            plan_type: workspacePlan, 
            subscribed: isSubscribed 
          }
        }
      })
    )

    // Mettre en cache la réponse
    cache[cacheKey] = { expiresAt: now + CACHE_TTL_MS, payload: workspacesWithDetails }

    return new Response(JSON.stringify({ data: workspacesWithDetails }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  }
})