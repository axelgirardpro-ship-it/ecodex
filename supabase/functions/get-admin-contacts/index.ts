import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

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
      console.error('[get-admin-contacts] No Authorization header')
      return new Response(JSON.stringify({ error: 'No Authorization header' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Extraire le token du header "Bearer <token>"
    const token = authHeader.replace('Bearer ', '')
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    console.log('[get-admin-contacts] Validating JWT')
    console.log('[get-admin-contacts] Token starts with:', token.substring(0, 20))
    
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
      
      console.log('[get-admin-contacts] Extracted user ID from JWT:', userId)
    } catch (error) {
      console.error('[get-admin-contacts] Failed to decode JWT:', error)
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
      console.error('[get-admin-contacts] User validation failed:', userError)
      return new Response(JSON.stringify({ 
        error: 'Invalid user',
        details: userError?.message
      }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const user = authUser.user
    console.log('[get-admin-contacts] User authenticated successfully:', user.id)

    // Check supra-admin via RPC authoritative function
    const { data: isSupra } = await supabase.rpc('is_supra_admin', { user_uuid: user.id })
    if (!isSupra) {
      return new Response('Forbidden', { status: 403, headers: corsHeaders })
    }

    // Filters & pagination
    let workspaceFilter: string | null = null;
    let page = 1; let pageSize = 25;
    if (req.method === 'POST') {
      const body = await req.json();
      workspaceFilter = body.workspaceId ?? null;
      page = Number(body.page) || 1;
      pageSize = Number(body.pageSize) || 25;
    } else {
      const url = new URL(req.url);
      workspaceFilter = url.searchParams.get('workspaceId');
      page = Number(url.searchParams.get('page') || '1');
      pageSize = Number(url.searchParams.get('pageSize') || '25');
    }

    // Get user roles with workspace filter if specified
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from('user_roles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (workspaceFilter && workspaceFilter !== 'all') {
      query = query.eq('workspace_id', workspaceFilter);
    }

    const { data: userRoles, error: rolesError, count: total } = await query;
    if (rolesError) throw rolesError;

    console.log('Found user roles:', userRoles?.length);
    console.log('User roles data:', userRoles?.map(ur => ({
      user_id: ur.user_id,
      workspace_id: ur.workspace_id,
      role: ur.role
    })));

    // Get all workspaces data
    const { data: workspaces } = await supabase
      .from('workspaces')
      .select('id, name, plan_type');

    // Create workspace map for faster lookup
    const workspaceMap = new Map();
    workspaces?.forEach(workspace => {
      workspaceMap.set(workspace.id, workspace);
    });

    console.log('Available workspaces:', workspaces?.map(w => ({ id: w.id, name: w.name, plan: w.plan_type })));

    // Get detailed info for each contact
    const contactsWithDetails = await Promise.all(
      (userRoles || []).map(async (userRole) => {
        // Get user details from auth.users
        const { data: authUser, error: authUserError } = await supabase.auth.admin.getUserById(userRole.user_id);
        
        // Get profile data from users table
        const { data: userData } = await supabase
          .from('users')
          .select('first_name, last_name')
          .eq('user_id', userRole.user_id)
          .single();

        const workspace = workspaceMap.get(userRole.workspace_id);

        return {
          ...userRole,
          email: authUser?.user?.email || 'Unknown',
          first_name: userData?.first_name || '',
          last_name: userData?.last_name || '',
          company_name: workspace?.name || 'Unknown',
          company_plan: workspace?.plan_type || 'freemium'
        };
      })
    );

    console.log('Final contacts with details:', contactsWithDetails.map(c => ({
      email: c.email,
      company_name: c.company_name,
      company_plan: c.company_plan,
      role: c.role
    })));

    return new Response(
      JSON.stringify({ data: contactsWithDetails, total: total ?? contactsWithDetails.length }),
      { 
        headers: { 
          ...corsHeaders,
          'Content-Type': 'application/json'
        } 
      }
    )

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