import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from JWT
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders })
    }

    // Check if user is supra admin
    // Check supra-admin via RPC for source of truth
    const { data: isSupra } = await supabase.rpc('is_supra_admin', { user_uuid: user.id })
    if (!isSupra) return new Response('Forbidden', { status: 403, headers: corsHeaders })

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

    // Define plan types based on filter
    let workspacesQuery = supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false });

    if (planFilter === 'freemium') {
      workspacesQuery = workspacesQuery.eq('plan_type', 'freemium');
      console.log('Filtering for freemium plans');
    } else if (planFilter === 'paid') {
      workspacesQuery = workspacesQuery.in('plan_type', ['standard', 'premium']);
      console.log('Filtering for paid plans');
    } else if (planFilter === 'all') {
      console.log('Getting all workspaces');
      // No filter for 'all'
    } else {
      // Default to paid plans for invalid filter
      workspacesQuery = workspacesQuery.in('plan_type', ['standard', 'premium']);
      console.log('Invalid filter, defaulting to paid plans');
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

        // Use workspace plan_type instead of user subscription
        // The billing is at workspace level, not user level
        const workspacePlan = workspace.plan_type || 'freemium'
        const isSubscribed = workspacePlan === 'premium' || workspacePlan === 'standard'

        return {
          ...workspace,
          owner_email: authUser?.user?.email || 'Unknown',
          user_count: userCount || 0,
          subscription_status: { 
            plan_type: workspacePlan, 
            subscribed: isSubscribed 
          }
        }
      })
    )

    return new Response(
      JSON.stringify({ data: workspacesWithDetails }),
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