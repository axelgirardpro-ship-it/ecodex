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
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'supra_admin')
      .is('workspace_id', null)
      .single()

    if (!roleData) {
      return new Response('Forbidden', { status: 403, headers: corsHeaders })
    }

    // Get filter parameter for workspace
    let workspaceFilter = null;
    if (req.method === 'POST') {
      const body = await req.json();
      workspaceFilter = body.workspaceId;
    } else {
      const url = new URL(req.url);
      workspaceFilter = url.searchParams.get('workspaceId');
    }

    // Get user roles with workspace filter if specified
    let query = supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: false });

    if (workspaceFilter && workspaceFilter !== 'all') {
      query = query.eq('workspace_id', workspaceFilter);
    }

    const { data: userRoles, error: rolesError } = await query;
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
      JSON.stringify({ data: contactsWithDetails }),
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